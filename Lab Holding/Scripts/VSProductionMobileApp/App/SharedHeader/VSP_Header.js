/* @fileName VSP_Header.js */
(function (global) {
    var ICON_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>';
    var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';
    var ICON_HOME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>';
    var ICON_LOGOUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
    var ICON_INGREDIENTS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v5.5L4.8 18a2 2 0 0 0 1.75 3h10.9a2 2 0 0 0 1.75-3L14 8.5V3"/><path d="M7.5 14h9"/></svg>';

    var ICON_MAP = {
        home: ICON_HOME,
        manageIngredients: ICON_INGREDIENTS
    };

    function initials(name) {
        if (!name) return 'U';
        var parts = name.trim().split(/\s+/);
        var first = parts[0] ? parts[0].charAt(0) : '';
        var last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
        return (first + last).toUpperCase() || 'U';
    }

    function renderHeader(config) {
        try {
            var container = document.getElementById('sharedHeader');
            if (!container) return;

            config = config || {};
            var user = config.user || {};
            var homeUrl = config.homeUrl || window.location.href;
            var navItems = config.navItems || [
                { id: 'home', label: 'Home', href: homeUrl, icon: ICON_HOME, active: true }
            ];

            var metaParts = [];
            if (user.subsidiaryName) metaParts.push(user.subsidiaryName);
            if (user.locationName) metaParts.push(user.locationName);

            container.innerHTML =
                '<header class="app-header">' +
                    '<button id="navToggle" class="icon-btn" type="button" aria-label="Open menu" aria-expanded="false">' + ICON_MENU + '</button>' +
                    '<div class="brand">' +
                        '<img id="companyLogo" alt="" class="company-logo hidden">' +
                        '<div class="brand-fallback" id="companyFallback">VS</div>' +
                        '<div class="brand-text">' +
                            '<div class="company-title">' +
                                '<span id="companyName" class="company-name"></span>' +
                                '<span id="sandboxBadge" class="sandbox-badge hidden">Sandbox</span>' +
                            '</div>' +
                            '<div id="userMeta" class="user-meta"></div>' +
                        '</div>' +
                    '</div>' +
                    '<button id="logoutButton" class="icon-btn logout-btn" type="button" aria-label="Logout">' + ICON_LOGOUT + '</button>' +
                '</header>' +
                '<div id="navOverlay" class="nav-overlay hidden"></div>' +
                '<aside id="sideNav" class="side-nav" aria-hidden="true">' +
                    '<div class="side-nav-header">' +
                        '<div class="side-nav-user">' +
                            '<div class="user-avatar" id="userAvatar"></div>' +
                            '<div>' +
                                '<div class="side-nav-name" id="sideNavName"></div>' +
                                '<div class="side-nav-sub" id="sideNavSub"></div>' +
                            '</div>' +
                        '</div>' +
                        '<button id="navClose" class="icon-btn" type="button" aria-label="Close menu">' + ICON_CLOSE + '</button>' +
                    '</div>' +
                    '<nav class="side-nav-links" id="sideNavLinks"></nav>' +
                    '<div class="side-nav-footer">' +
                        '<button id="sideLogoutButton" class="side-logout-btn" type="button">' + ICON_LOGOUT + '<span>Logout</span></button>' +
                    '</div>' +
                '</aside>';

            var companyName = document.getElementById('companyName');
            var sandboxBadge = document.getElementById('sandboxBadge');
            var userMeta = document.getElementById('userMeta');
            var companyLogo = document.getElementById('companyLogo');
            var companyFallback = document.getElementById('companyFallback');
            var logoutButton = document.getElementById('logoutButton');
            var sideLogoutButton = document.getElementById('sideLogoutButton');
            var navToggle = document.getElementById('navToggle');
            var navClose = document.getElementById('navClose');
            var navOverlay = document.getElementById('navOverlay');
            var sideNav = document.getElementById('sideNav');
            var sideNavName = document.getElementById('sideNavName');
            var sideNavSub = document.getElementById('sideNavSub');
            var sideNavLinks = document.getElementById('sideNavLinks');
            var userAvatar = document.getElementById('userAvatar');

            companyName.textContent = user.companyName || 'VS Production';
            userMeta.textContent = metaParts.join(' · ');
            sideNavName.textContent = user.name || 'User';
            sideNavSub.textContent = metaParts.join(' · ');
            userAvatar.textContent = initials(user.name);

            sideNavLinks.innerHTML = navItems.map(function (item) {
                var icon = item.icon || ICON_MAP[item.id] || ICON_HOME;
                return '<a class="nav-link' + (item.active ? ' is-active' : '') + '" href="' + (item.href || '#') + '">' +
                    icon + '<span>' + item.label + '</span></a>';
            }).join('');

            if (user.isSandbox) {
                sandboxBadge.classList.remove('hidden');
            }

            if (user.logoUrl) {
                companyLogo.src = user.logoUrl;
                companyLogo.classList.remove('hidden');
                companyFallback.classList.add('hidden');
            }

            function openNav() {
                sideNav.classList.add('is-open');
                navOverlay.classList.remove('hidden');
                navOverlay.classList.add('is-open');
                sideNav.setAttribute('aria-hidden', 'false');
                navToggle.setAttribute('aria-expanded', 'true');
                document.body.style.overflow = 'hidden';
            }

            function closeNav() {
                sideNav.classList.remove('is-open');
                navOverlay.classList.remove('is-open');
                sideNav.setAttribute('aria-hidden', 'true');
                navToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
                window.setTimeout(function () {
                    if (!navOverlay.classList.contains('is-open')) {
                        navOverlay.classList.add('hidden');
                    }
                }, 200);
            }

            navToggle.addEventListener('click', openNav);
            navClose.addEventListener('click', closeNav);
            navOverlay.addEventListener('click', closeNav);
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') closeNav();
            });

            function handleLogout() {
                try {
                    if (typeof config.onLogout === 'function') {
                        config.onLogout();
                    }
                } catch (e) {
                    console.error('VS Production Header: logout handler error', e);
                }
            }

            logoutButton.addEventListener('click', handleLogout);
            sideLogoutButton.addEventListener('click', handleLogout);
        } catch (e) {
            console.error('VS Production Header: render error', e);
        }
    }

    global.VSProductionHeader = {
        render: renderHeader
    };
})(window);
