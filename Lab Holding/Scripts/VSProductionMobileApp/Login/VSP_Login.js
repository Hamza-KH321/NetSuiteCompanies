/* @fileName VSP_Login.js */
(function () {
    var form = document.getElementById('loginForm');
    var errorMessage = document.getElementById('errorMessage');
    var submitButton = document.getElementById('submitButton');
    var togglePassword = document.getElementById('togglePassword');
    var passwordInput = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            try {
                var isVisible = passwordInput.type === 'text';
                passwordInput.type = isVisible ? 'password' : 'text';
                togglePassword.classList.toggle('is-visible', !isVisible);
                togglePassword.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
            } catch (e) {
                console.error('VS Production Login: toggle password error', e);
            }
        });
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        try {
            var username = document.getElementById('username').value.trim();
            var password = passwordInput.value;

            errorMessage.textContent = '';

            if (!username || !password) {
                showError('Username and password are required.');
                return;
            }

            setLoading(true);

            fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'username=' + encodeURIComponent(username) + '&password=' + encodeURIComponent(password)
            })
                .then(function (response) { return response.json(); })
                .then(function (result) {
                    if (result && result.success && result.redirectUrl) {
                        window.location.href = result.redirectUrl;
                        return;
                    }

                    showError(result && result.message ? result.message : 'Login failed.');
                    setLoading(false);
                })
                .catch(function (e) {
                    console.error('VS Production Login: request error', e);
                    showError('Login failed. Please try again.');
                    setLoading(false);
                });
        } catch (e) {
            console.error('VS Production Login: submit error', e);
            showError('An unexpected error occurred. Please try again.');
            setLoading(false);
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('shake');
        // eslint-disable-next-line no-unused-expressions
        errorMessage.offsetWidth;
        errorMessage.classList.add('shake');
    }

    function setLoading(isLoading) {
        submitButton.disabled = isLoading;
        submitButton.classList.toggle('is-loading', isLoading);
    }
})();
