/* @fileName VSP_Home.js */
(function () {
    var loadingOverlay = document.getElementById('loadingOverlay');
    var greeting = document.getElementById('greeting');
    var homeMessage = document.getElementById('homeMessage');
    var employeeName = document.getElementById('employeeName');
    var subsidiaryName = document.getElementById('subsidiaryName');
    var locationName = document.getElementById('locationName');
    var quickActions = document.getElementById('quickActions');
    var quickActionsTitle = document.getElementById('quickActionsTitle');

    var QUICK_ACTION_INFO = {
        manageIngredients: {
            subtitle: 'Load an order and update ingredient quantities',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v5.5L4.8 18a2 2 0 0 0 1.75 3h10.9a2 2 0 0 0 1.75-3L14 8.5V3"/><path d="M7.5 14h9"/></svg>'
        }
    };
    var ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

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

    function render(data) {
        var user = data.user || {};

        VSProductionHeader.render({
            user: user,
            homeUrl: data.homeUrl,
            navItems: data.navItems,
            onLogout: logout
        });

        var firstName = user.name ? user.name.trim().split(/\s+/)[0] : '';
        greeting.textContent = firstName ? 'Welcome, ' + firstName : 'Welcome';
        homeMessage.textContent = 'Signed in and ready for the next VS Production workflow.';
        employeeName.textContent = user.name || '-';
        subsidiaryName.textContent = user.subsidiaryName || '-';
        locationName.textContent = user.locationName || '-';

        renderQuickActions(data.navItems || []);
    }

    function renderQuickActions(navItems) {
        if (!quickActions) return;

        var actions = navItems.filter(function (item) {
            return !item.active && QUICK_ACTION_INFO[item.id];
        });

        if (quickActionsTitle) {
            quickActionsTitle.classList.toggle('hidden', actions.length === 0);
        }

        quickActions.innerHTML = actions.map(function (item) {
            var info = QUICK_ACTION_INFO[item.id] || {};
            return (
                '<a class="quick-action-card" href="' + (item.href || '#') + '">' +
                    '<span class="quick-action-icon">' + (info.icon || '') + '</span>' +
                    '<span class="quick-action-text">' +
                        '<span class="quick-action-title">' + item.label + '</span>' +
                        '<span class="quick-action-subtitle">' + (info.subtitle || '') + '</span>' +
                    '</span>' +
                    '<span class="quick-action-chevron">' + ICON_CHEVRON + '</span>' +
                '</a>'
            );
        }).join('');
    }

    setLoading(true);
    post('bootstrapHome')
        .then(function (result) {
            if (!result || !result.success) {
                throw new Error(result && result.message ? result.message : 'Unable to load homepage.');
            }

            render(result.data || {});
            setLoading(false);
        })
        .catch(function (error) {
            homeMessage.textContent = error.message || 'Unable to load homepage.';
            homeMessage.classList.add('error');
            setLoading(false);
        });
})();
