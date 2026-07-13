/* @fileName VSP_Header.js */
(function (global) {
    var ICON_HOME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>';
    var ICON_LOGOUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';

    function renderHeader(config) {
        try {
            var container = document.getElementById('sharedHeader');
            if (!container) return;

            config = config || {};
            var user = config.user || {};

            container.innerHTML =
                '<header class="app-header">' +
                    '<div class="brand">' +
                        '<img id="companyLogo" alt="" class="company-logo hidden">' +
                        '<div class="brand-fallback" id="companyFallback">VS</div>' +
                        '<div>' +
                            '<div class="company-title">' +
                                '<div id="companyName" class="company-name"></div>' +
                                '<span id="sandboxBadge" class="sandbox-badge hidden">Sandbox</span>' +
                            '</div>' +
                            '<div id="userName" class="user-name"></div>' +
                        '</div>' +
                    '</div>' +
                    '<nav class="header-actions">' +
                        '<a id="homeButton" class="button-link secondary" href="#">' + ICON_HOME + '<span>Home</span></a>' +
                        '<button id="logoutButton" class="ghost" type="button">' + ICON_LOGOUT + '<span>Logout</span></button>' +
                    '</nav>' +
                '</header>';

            var companyName = document.getElementById('companyName');
            var sandboxBadge = document.getElementById('sandboxBadge');
            var userName = document.getElementById('userName');
            var companyLogo = document.getElementById('companyLogo');
            var companyFallback = document.getElementById('companyFallback');
            var homeButton = document.getElementById('homeButton');
            var logoutButton = document.getElementById('logoutButton');

            companyName.textContent = user.companyName || 'VS Production';
            userName.textContent = user.name || '';
            homeButton.href = config.homeUrl || window.location.href;

            if (user.isSandbox) {
                sandboxBadge.classList.remove('hidden');
            }

            if (user.logoUrl) {
                companyLogo.src = user.logoUrl;
                companyLogo.classList.remove('hidden');
                companyFallback.classList.add('hidden');
            }

            logoutButton.addEventListener('click', function () {
                try {
                    if (typeof config.onLogout === 'function') {
                        config.onLogout();
                    }
                } catch (e) {
                    console.error('VS Production Header: logout handler error', e);
                }
            });
        } catch (e) {
            console.error('VS Production Header: render error', e);
        }
    }

    global.VSProductionHeader = {
        render: renderHeader
    };
})(window);
