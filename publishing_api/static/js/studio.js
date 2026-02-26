/**
 * Studio JS: interactivity layer for Django Studio.
 *
 * Systems:
 *   1. Status Pipeline: clickable stage progression bar
 *   2. Markdown Toolbar: formatting buttons for the body textarea
 *   3. Autosave: debounced field-level saves
 *   4. Character counters, Tab indent, Cmd+S
 *   5. Structured list widget: add/remove rows
 */

(function () {
    'use strict';

    // ─── Utilities ──────────────────────────────────────────────────────

    function getCSRFToken() {
        var el = document.querySelector('[name=csrfmiddlewaretoken]');
        return el ? el.value : '';
    }

    // ─── 1. Status Pipeline ─────────────────────────────────────────────

    function initPipeline() {
        var header = document.getElementById('status-pipeline');
        if (!header) return;

        var stages;
        try {
            stages = JSON.parse(header.dataset.stages);
        } catch (e) {
            return;
        }
        if (!stages || !stages.length) return;

        var current = header.dataset.current || '';
        var url = header.dataset.url || '';

        function render(activeStage) {
            while (header.firstChild) header.removeChild(header.firstChild);

            var currentIdx = stages.indexOf(activeStage);

            stages.forEach(function (stage, idx) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pipeline-stage';
                btn.textContent = stage.replace(/_/g, ' ');
                btn.dataset.stage = stage;

                if (idx < currentIdx) {
                    btn.classList.add('pipeline-complete');
                } else if (idx === currentIdx) {
                    btn.classList.add('pipeline-current');
                } else {
                    btn.classList.add('pipeline-upcoming');
                }

                // Connector line between stages
                if (idx > 0) {
                    var line = document.createElement('span');
                    line.className = 'pipeline-connector';
                    if (idx <= currentIdx) {
                        line.classList.add('pipeline-connector-active');
                    }
                    header.appendChild(line);
                }

                header.appendChild(btn);
            });
        }

        render(current);

        // Click handler: advance or roll back stage
        header.addEventListener('click', function (e) {
            var btn = e.target.closest('.pipeline-stage');
            if (!btn || !url) return;

            var newStage = btn.dataset.stage;
            if (newStage === current) return;

            // Optimistic UI update
            var oldCurrent = current;
            current = newStage;
            render(current);

            // Also update hidden stage/status field in the form
            var stageSelect = document.querySelector('#id_stage, #id_status');
            if (stageSelect) {
                stageSelect.value = newStage;
            }

            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ stage: newStage })
            })
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
                if (!data.success) {
                    // Revert on failure
                    current = oldCurrent;
                    render(current);
                    if (stageSelect) stageSelect.value = oldCurrent;
                }
            })
            .catch(function () {
                current = oldCurrent;
                render(current);
                if (stageSelect) stageSelect.value = oldCurrent;
            });
        });
    }

    // ─── 2. Markdown Toolbar ────────────────────────────────────────────

    function initToolbar() {
        var toolbar = document.getElementById('editor-toolbar');
        if (!toolbar) return;

        var textarea = document.getElementById('editor-body');
        if (!textarea) return;

        function wrapSelection(before, after) {
            var start = textarea.selectionStart;
            var end = textarea.selectionEnd;
            var selected = textarea.value.substring(start, end);
            var replacement = before + selected + after;
            textarea.setRangeText(replacement, start, end, 'select');
            textarea.focus();
            // Place cursor after the inserted text if nothing was selected
            if (start === end) {
                textarea.selectionStart = start + before.length;
                textarea.selectionEnd = start + before.length;
            }
        }

        function insertAtLineStart(prefix) {
            var start = textarea.selectionStart;
            var val = textarea.value;
            // Find the beginning of the current line
            var lineStart = val.lastIndexOf('\n', start - 1) + 1;
            textarea.setRangeText(prefix, lineStart, lineStart, 'end');
            textarea.focus();
        }

        function insertText(text) {
            var start = textarea.selectionStart;
            textarea.setRangeText(text, start, textarea.selectionEnd, 'end');
            textarea.focus();
        }

        var actions = {
            bold: function () { wrapSelection('**', '**'); },
            italic: function () { wrapSelection('*', '*'); },
            h2: function () { insertAtLineStart('## '); },
            h3: function () { insertAtLineStart('### '); },
            h4: function () { insertAtLineStart('#### '); },
            rule: function () { insertText('\n---\n'); },
            ul: function () { insertAtLineStart('- '); },
            ol: function () { insertAtLineStart('1. '); },
            blockquote: function () { insertAtLineStart('> '); },
            code: function () {
                var start = textarea.selectionStart;
                var end = textarea.selectionEnd;
                var selected = textarea.value.substring(start, end);
                if (selected.indexOf('\n') !== -1) {
                    wrapSelection('\n```\n', '\n```\n');
                } else {
                    wrapSelection('`', '`');
                }
            },
            link: function () {
                var start = textarea.selectionStart;
                var end = textarea.selectionEnd;
                var selected = textarea.value.substring(start, end);
                if (selected) {
                    wrapSelection('[', '](url)');
                } else {
                    insertText('[link text](url)');
                }
            }
        };

        toolbar.addEventListener('click', function (e) {
            var btn = e.target.closest('.toolbar-btn');
            if (!btn) return;
            var action = btn.dataset.action;
            if (actions[action]) {
                e.preventDefault();
                actions[action]();
            }
        });

        // Keyboard shortcuts: Cmd+B, Cmd+I, Cmd+K
        textarea.addEventListener('keydown', function (e) {
            if (!(e.metaKey || e.ctrlKey)) return;
            if (e.key === 'b') { e.preventDefault(); actions.bold(); }
            else if (e.key === 'i') { e.preventDefault(); actions.italic(); }
            else if (e.key === 'k') { e.preventDefault(); actions.link(); }
        });
    }

    // ─── 3. Autosave ────────────────────────────────────────────────────

    function initAutosave() {
        var form = document.getElementById('content-form');
        if (!form) return;

        // Determine content type and slug from the page URL or data attrs
        var body = document.body;
        var contentType = body.dataset.contentType;
        var slug = body.dataset.slug;
        if (!contentType || !slug) return;

        var indicator = document.getElementById('save-indicator');
        var saveTimer = null;
        var lastSavedValues = {};

        // Capture initial field values
        var trackedFields = form.querySelectorAll(
            'input:not([type=hidden]):not([type=submit]),' +
            'textarea, select'
        );
        trackedFields.forEach(function (field) {
            if (field.name) {
                lastSavedValues[field.name] = field.value;
            }
        });

        function getChangedFields() {
            var changed = {};
            trackedFields.forEach(function (field) {
                if (!field.name) return;
                var current = field.type === 'checkbox' ? field.checked : field.value;
                var last = lastSavedValues[field.name];
                if (current !== last) {
                    changed[field.name] = current;
                }
            });
            return changed;
        }

        function doAutosave() {
            var changed = getChangedFields();
            if (Object.keys(changed).length === 0) return;

            if (indicator) {
                indicator.textContent = 'Saving...';
                indicator.style.color = 'var(--studio-text-faint)';
            }

            fetch('/auto-save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    content_type: contentType,
                    slug: slug,
                    fields: changed
                })
            })
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
                if (data.saved) {
                    // Update tracked values so we only send diffs next time
                    Object.keys(changed).forEach(function (key) {
                        lastSavedValues[key] = changed[key];
                    });
                    if (indicator) {
                        indicator.textContent = 'Saved';
                        indicator.style.color = 'var(--studio-success)';
                        setTimeout(function () { indicator.textContent = ''; }, 3000);
                    }
                } else if (indicator) {
                    indicator.textContent = 'Save failed';
                    indicator.style.color = 'var(--studio-error)';
                }
            })
            .catch(function () {
                if (indicator) {
                    indicator.textContent = 'Save failed';
                    indicator.style.color = 'var(--studio-error)';
                }
            });
        }

        function scheduleAutosave() {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(doAutosave, 3000);
        }

        // Listen on tracked fields
        trackedFields.forEach(function (field) {
            field.addEventListener('input', scheduleAutosave);
            field.addEventListener('change', scheduleAutosave);
        });
    }

    // ─── 4. Character Counters ──────────────────────────────────────────

    function initCharCounters() {
        document.querySelectorAll('.field-count').forEach(function (counter) {
            var max = parseInt(counter.dataset.max, 10);
            var fieldId = counter.dataset.field;
            var field = document.getElementById(fieldId);
            if (!field) return;

            function update() {
                var len = field.value.length;
                counter.textContent = len + ' / ' + max;
                counter.style.color = len > max ? 'var(--studio-error)' : '';
            }

            field.addEventListener('input', update);
            update();
        });
    }

    // ─── 5. Tab Key in Textarea ─────────────────────────────────────────

    function initTabIndent() {
        var body = document.getElementById('editor-body');
        if (!body || body.tagName !== 'TEXTAREA') return;

        body.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                var start = this.selectionStart;
                var end = this.selectionEnd;
                this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 4;
            }
        });
    }

    // ─── 6. Cmd/Ctrl+S to Save ──────────────────────────────────────────

    function initSaveShortcut() {
        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                var form = document.getElementById('content-form');
                if (form) form.submit();
            }
        });
    }

    // ─── 7. Structured List Widget: add/remove rows ─────────────────────

    function initStructuredLists() {
        document.querySelectorAll('.structured-list').forEach(function (container) {
            var fieldName = container.dataset.fieldName;
            var schemaStr = container.dataset.schema;
            if (!fieldName || !schemaStr) return;

            var schema;
            try {
                schema = JSON.parse(schemaStr);
            } catch (e) {
                return;
            }

            function reindex() {
                var rows = container.querySelectorAll('.structured-row');
                rows.forEach(function (row, idx) {
                    row.querySelectorAll('input, textarea, select').forEach(function (input) {
                        var parts = input.name.split('__');
                        if (parts.length === 3) {
                            input.name = parts[0] + '__' + idx + '__' + parts[2];
                        }
                    });
                });
            }

            function createRow(idx, values) {
                var row = document.createElement('div');
                row.className = 'structured-row';

                schema.forEach(function (field) {
                    var wrapper = document.createElement('div');
                    wrapper.className = 'structured-field';

                    var label = document.createElement('label');
                    label.textContent = field.label;
                    label.className = 'structured-label';
                    wrapper.appendChild(label);

                    var input;
                    if (field.type === 'textarea') {
                        input = document.createElement('textarea');
                        input.rows = 2;
                    } else if (field.type === 'select' && field.options) {
                        input = document.createElement('select');
                        field.options.forEach(function (opt) {
                            var option = document.createElement('option');
                            option.value = opt;
                            option.textContent = opt;
                            input.appendChild(option);
                        });
                    } else if (field.type === 'number') {
                        input = document.createElement('input');
                        input.type = 'number';
                    } else {
                        input = document.createElement('input');
                        input.type = 'text';
                    }

                    input.name = fieldName + '__' + idx + '__' + field.name;
                    input.className = 'structured-input';
                    if (field.placeholder) input.placeholder = field.placeholder;
                    if (values && values[field.name] !== undefined) {
                        input.value = values[field.name];
                    }

                    wrapper.appendChild(input);
                    row.appendChild(wrapper);
                });

                var removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'structured-remove';
                removeBtn.textContent = '\u00d7';
                removeBtn.title = 'Remove';
                removeBtn.addEventListener('click', function () {
                    row.remove();
                    reindex();
                });
                row.appendChild(removeBtn);

                return row;
            }

            // Add row button
            var addBtn = container.querySelector('.structured-add');
            if (addBtn) {
                addBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    var rows = container.querySelectorAll('.structured-row');
                    var newRow = createRow(rows.length, null);
                    container.insertBefore(newRow, addBtn);
                });
            }

            // Remove buttons on existing rows
            container.querySelectorAll('.structured-remove').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    btn.closest('.structured-row').remove();
                    reindex();
                });
            });
        });
    }

    // ─── Init ───────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', function () {
        initPipeline();
        initToolbar();
        initAutosave();
        initCharCounters();
        initTabIndent();
        initSaveShortcut();
        initStructuredLists();
    });
})();
