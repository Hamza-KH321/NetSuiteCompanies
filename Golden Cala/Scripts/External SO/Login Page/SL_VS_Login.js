/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/file', 'N/runtime', 'N/log', 'N/crypto', 'N/url', 'N/encode', './VS_Token_Helper', 'N/https'],
    function (serverWidget, search, record, file, runtime, log, crypto, url, encode, tokenHelper, https) {
        var SERVICE_ID = '3';
        function onRequest(context) {
            var errorMessage = '';
            var subscription = validateSubscription();

            if (!subscription.success) {
                context.response.write(subscription.message);
                return;
            }

            log.debug('Request Method', context.request.method);

            if (context.request.method === 'POST') {
                try {
                    var username = context.request.parameters.username;
                    var password = context.request.parameters.password;

                    var recaptchaResponse = context.request.parameters['g-recaptcha-response'];
                    log.debug('reCAPTCHA Response Token', recaptchaResponse);

                    if (!recaptchaResponse) {
                        errorMessage = 'Please complete the CAPTCHA.';
                        throw new Error('CAPTCHA not completed');
                    }

                    // Verify reCAPTCHA with Google
                    var verificationResponse = https.post({
                        url: 'https://www.google.com/recaptcha/api/siteverify',
                        body: 'secret=6LduT0srAAAAAHLiB2KvABwGQYSgyI-LSDO7jXqz&response=' + recaptchaResponse,
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                    });

                    var responseBody = JSON.parse(verificationResponse.body);
                    log.debug('reCAPTCHA Verification Response', responseBody);

                    if (!responseBody.success) {
                        errorMessage = 'CAPTCHA validation failed. Please try again.';
                        throw new Error('CAPTCHA server-side validation failed');
                    }



                    // ✅ STEP 2: Search for user
                    var userSearch = search.create({
                        type: 'customrecord_vs_customer_users',
                        filters: [['custrecord_vs_uc_username', 'is', username]],
                        columns: ['internalid', 'custrecord_vs_uc_customer']
                    });

                    var searchResult = userSearch.run().getRange({ start: 0, end: 1 });
                    log.debug('User Search Result Length', searchResult.length);

                    if (searchResult.length > 0) {
                        var userId = parseInt(searchResult[0].getValue({ name: 'internalid' }), 10);
                        var customerId = searchResult[0].getValue({ name: 'custrecord_vs_uc_customer' });
                        log.debug("Login Attempt", { username: username, userId: userId, customerId: customerId });

                        // ✅ STEP 3: Validate password
                        var isValid = crypto.checkPasswordField({
                            recordType: 'customrecord_vs_customer_users',
                            recordId: userId,
                            fieldId: 'custrecord_vs_uc_password',
                            value: password
                        });

                        log.debug('Password Valid?', isValid);

                        if (isValid) {
                            const token = tokenHelper.createToken({ userId, customerId });


                            // ✅ STEP 5: Redirect with token
                            var externalUrl = url.resolveScript({
                                scriptId: 'customscript_vs_sl_customer_sales_ord',
                                deploymentId: 'customdeploy1',
                                params: { token: token },
                                returnExternalUrl: true
                            });

                            log.debug('Redirect URL', externalUrl);

                            context.response.write('<html><head><meta http-equiv="refresh" content="0;url=' + externalUrl + '"></head><body></body></html>');
                            return;
                        } else {
                            errorMessage = 'Invalid username or password.';
                        }
                    } else {
                        errorMessage = 'Invalid username or password.';
                    }

                } catch (e) {
                    log.error('Login Error', e);
                    errorMessage = 'An error occurred during login.';
                }
            }

            // ✅ STEP 6: Serve login page
            try {
                var htmlFile = file.load({ id: 'External SO/VS_Login_Page.html' });
                var htmlContent = htmlFile.getContents();

                if (errorMessage) {
                    var errorHTML = '<p style="color:red; font-weight:bold;">' + errorMessage + '</p>';
                    htmlContent = htmlContent.replace('</form>', errorHTML + '</form>');
                }

                context.response.write(htmlContent);
            } catch (e) {
                log.error('Error loading HTML', e);
                context.response.write('Error loading login page.');
            }
        }
        function getCompanyCode() {
            return runtime.accountId;
        }

        function validateSubscription() {

            try {

                var companyCode = getCompanyCode().toLowerCase();

                var suiteletUrl =
                    'https://59289.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=170&deploy=1&compid=59289&ns-at=AAEJ7tMQ4cjbLyCcBegmGCoMgSw8jVrmHhU2e0jPrMsIW6Qo8FA&service=' +
                    SERVICE_ID +
                    '&companycode=' +
                    companyCode;

                log.debug('Subscription URL', suiteletUrl);

                var response = https.get({
                    url: suiteletUrl
                });

                log.debug('Subscription Response', response.body);

                var result = JSON.parse(response.body);

                log.debug('Subscription Result', result);

                if (!result.success || !result.subscribed) {

                    return {
                        success: false,
                        message: 'Unexpected Error. Please contact your NetSuite implementation partner for assistance.'
                    };

                }

                return {
                    success: true
                };

            } catch (e) {

                log.error('validateSubscription', e);

                return {
                    success: false,
                    message: 'Unexpected Error. Please contact your NetSuite implementation partner for assistance.'
                };

            }

        }
        return { onRequest: onRequest };
    });
