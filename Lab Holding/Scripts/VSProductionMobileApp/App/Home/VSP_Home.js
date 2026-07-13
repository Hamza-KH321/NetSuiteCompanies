/* @fileName VSP_Home.js */
(function () {
    var loadingOverlay = document.getElementById('loadingOverlay');
    var homeMessage = document.getElementById('homeMessage');
    var employeeName = document.getElementById('employeeName');
    var subsidiaryName = document.getElementById('subsidiaryName');
    var locationName = document.getElementById('locationName');

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
            onLogout: logout
        });

        homeMessage.textContent = 'Signed in and ready for the next VS Production workflow.';
        employeeName.textContent = user.name || '-';
        subsidiaryName.textContent = user.subsidiaryName || '-';
        locationName.textContent = user.locationName || '-';
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
