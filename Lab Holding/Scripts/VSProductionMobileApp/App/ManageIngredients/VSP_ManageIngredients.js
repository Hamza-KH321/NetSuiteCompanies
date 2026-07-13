/* @fileName VSP_ManageIngredients.js */
(function () {
    var loadingOverlay = document.getElementById('loadingOverlay');
    var orderNumberInput = document.getElementById('orderNumberInput');
    var loadOrderButton = document.getElementById('loadOrderButton');
    var searchError = document.getElementById('searchError');
    var orderResult = document.getElementById('orderResult');
    var emptyState = document.getElementById('emptyState');
    var orderNumberEl = document.getElementById('orderNumber');
    var orderRecipeEl = document.getElementById('orderRecipe');
    var orderQtyEl = document.getElementById('orderQty');
    var orderNotesEl = document.getElementById('orderNotes');
    var ingredientList = document.getElementById('ingredientList');
    var saveButton = document.getElementById('saveButton');
    var saveStatus = document.getElementById('saveStatus');

    var originalQuantities = {};

    function post(action, payload) {
        var body = payload || {};
        body.action = action;

        return fetch(window.location.href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (response) {
            return response.json();
        });
    }

    function setLoading(isLoading) {
        if (!loadingOverlay) return;
        loadingOverlay.classList.toggle('hidden', !isLoading);
    }

    function logout() {
        setLoading(true);
        post('logout')
            .then(function (result) {
                if (result && result.success && result.redirectUrl) {
                    window.location.href = result.redirectUrl;
                    return;
                }
                setLoading(false);
            })
            .catch(function () {
                setLoading(false);
            });
    }

    function showSearchError(message) {
        searchError.textContent = message;
        searchError.classList.toggle('hidden', !message);
    }

    function renderIngredients(lines) {
        originalQuantities = {};
        ingredientList.innerHTML = lines.map(function (line) {
            originalQuantities[line.id] = line.qty;
            return (
                '<div class="ingredient-card">' +
                    '<div class="ingredient-name">' + escapeHtml(line.itemName || 'Ingredient') + '</div>' +
                    '<div class="qty-block">' +
                        '<span class="qty-label">Qty (Recipe)</span>' +
                        '<div class="qty-row">' +
                            '<div class="qty-box">' + escapeHtml(line.qtyRecipe) + '</div>' +
                            '<div class="unit-box">' + escapeHtml(line.unitName || '') + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="qty-block">' +
                        '<span class="qty-label">Input Qty</span>' +
                        '<div class="qty-row">' +
                            '<input class="qty-input" type="text" inputmode="decimal" data-line-id="' + escapeAttr(line.id) + '" value="' + escapeAttr(line.qty) + '">' +
                            '<div class="unit-box">' + escapeHtml(line.unitName || '') + '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            );
        }).join('');

        var inputs = ingredientList.querySelectorAll('.qty-input');
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].addEventListener('input', handleQtyInput);
        }

        updateSaveState();
    }

    function handleQtyInput(event) {
        var input = event.target;
        var lineId = input.getAttribute('data-line-id');
        var isDirty = input.value !== String(originalQuantities[lineId]);
        input.classList.toggle('is-dirty', isDirty);
        updateSaveState();
    }

    function getDirtyLines() {
        var inputs = ingredientList.querySelectorAll('.qty-input');
        var dirty = [];

        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            var lineId = input.getAttribute('data-line-id');
            if (input.value !== String(originalQuantities[lineId])) {
                dirty.push({ id: lineId, qty: input.value });
            }
        }

        return dirty;
    }

    function updateSaveState() {
        var dirtyLines = getDirtyLines();
        saveButton.disabled = dirtyLines.length === 0;
        saveStatus.textContent = dirtyLines.length
            ? dirtyLines.length + ' ingredient' + (dirtyLines.length === 1 ? '' : 's') + ' changed'
            : 'No changes';
        saveStatus.classList.remove('success', 'error');
    }

    function renderOrder(data) {
        orderNumberEl.textContent = data.orderNumber || '-';
        orderRecipeEl.textContent = data.recipeName || '-';
        orderQtyEl.textContent = data.orderQty || '-';

        if (data.notes) {
            orderNotesEl.textContent = data.notes;
            orderNotesEl.classList.remove('hidden');
        } else {
            orderNotesEl.classList.add('hidden');
        }

        renderIngredients(data.lines || []);

        orderResult.classList.remove('hidden');
        emptyState.classList.add('hidden');
    }

    function loadOrder() {
        var orderNumber = orderNumberInput.value.trim();
        showSearchError('');

        if (!orderNumber) {
            showSearchError('Enter a production order number.');
            return;
        }

        setLoading(true);
        post('lookupProductionOrder', { orderNumber: orderNumber })
            .then(function (result) {
                setLoading(false);

                if (!result || !result.success) {
                    orderResult.classList.add('hidden');
                    emptyState.classList.remove('hidden');
                    showSearchError(result && result.message ? result.message : 'Unable to load production order.');
                    return;
                }

                renderOrder(result.data || {});
            })
            .catch(function () {
                setLoading(false);
                showSearchError('Unable to load production order. Please try again.');
            });
    }

    function saveChanges() {
        var dirtyLines = getDirtyLines();
        if (!dirtyLines.length) return;

        saveButton.disabled = true;
        saveStatus.textContent = 'Saving...';
        saveStatus.classList.remove('success', 'error');

        post('saveIngredientQuantities', { lines: dirtyLines })
            .then(function (result) {
                if (!result || !result.success) {
                    saveStatus.textContent = result && result.message ? result.message : 'Save failed.';
                    saveStatus.classList.add('error');
                    saveButton.disabled = false;
                    return;
                }

                dirtyLines.forEach(function (line) {
                    originalQuantities[line.id] = line.qty;
                });

                var inputs = ingredientList.querySelectorAll('.qty-input');
                for (var i = 0; i < inputs.length; i++) {
                    inputs[i].classList.remove('is-dirty');
                }

                saveStatus.textContent = 'Changes saved.';
                saveStatus.classList.add('success');
                saveButton.disabled = true;
            })
            .catch(function () {
                saveStatus.textContent = 'Save failed. Please try again.';
                saveStatus.classList.add('error');
                saveButton.disabled = false;
            });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escapeAttr(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;');
    }

    loadOrderButton.addEventListener('click', loadOrder);
    orderNumberInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') loadOrder();
    });
    saveButton.addEventListener('click', saveChanges);

    setLoading(true);
    post('bootstrapManageIngredients')
        .then(function (result) {
            setLoading(false);

            if (!result || !result.success) {
                return;
            }

            var data = result.data || {};
            VSProductionHeader.render({
                user: data.user,
                homeUrl: data.homeUrl,
                navItems: data.navItems,
                onLogout: logout
            });
        })
        .catch(function () {
            setLoading(false);
        });
})();
