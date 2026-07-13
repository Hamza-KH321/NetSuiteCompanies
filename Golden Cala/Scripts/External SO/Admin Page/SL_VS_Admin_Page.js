/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * Script Name: SL || Customer Users Admin Page
 * Description: This Suitelet displays a custom admin page for managing Customer Users 
 *              (customrecord_vs_customer_users). It restricts access to a specific list 
 *              of internal user IDs and allows the admin to:
 *              - View all existing customer user records
 *              - Open a selected record in edit mode
 *              - Create a new user record
 *              - Delete a user record
 *              The Suitelet loads an external HTML file and injects the user data into the frontend.
 */

define(['N/ui/serverWidget', 'N/search', 'N/file', 'N/log', 'N/url', 'N/redirect', 'N/runtime', 'N/record'],
    function (serverWidget, search, file, log, url, redirect, runtime, record) {

        function onRequest(context) {
            var currentUserId = runtime.getCurrentUser().id;
            var allowedUsers = [1469, 4, 6, -5, 1514, 3];

            if (!allowedUsers.includes(parseInt(currentUserId))) {
                var errorHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Access Denied</title>
                        <style>
                            body {
                                background-color: #f8f8f8;
                                font-family: Arial, sans-serif;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                            }
                            .error-box {
                                background-color: #fff;
                                border: 1px solid #ddd;
                                border-radius: 10px;
                                padding: 40px;
                                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
                                text-align: center;
                            }
                            .error-box h2 {
                                color: #e74c3c;
                                font-size: 24px;
                                margin-bottom: 10px;
                            }
                            .error-box p {
                                color: #555;
                                font-size: 16px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="error-box">
                            <h2>🚫 Access Denied</h2>
                            <p>You do not have permission to view this page.</p>
                        </div>
                    </body>
                    </html>
                `;
                context.response.write(errorHtml);
                return;
            }

            // 👇 Continue with original logic below if user is allowed

            if (context.request.method === 'POST') {
                var recordId = context.request.parameters.recordId;
                var createNew = context.request.parameters.createNew;
                var doDelete = context.request.parameters.delete;

                if (createNew === 'true') {
                    var newRecordUrl = url.resolveRecord({
                        recordType: 'customrecord_vs_customer_users',
                        isEditMode: true
                    });

                    redirect.redirect({
                        url: newRecordUrl
                    });
                    return;
                }

                if (doDelete === 'true') {
                    try {
                        record.delete({
                            type: 'customrecord_vs_customer_users',
                            id: recordId
                        });
                        log.audit('Record Deleted', 'ID: ' + recordId);
                    } catch (err) {
                        log.error('Delete Error', err);
                    }

                    redirect.redirect({
                        url: url.resolveScript({
                            scriptId: runtime.getCurrentScript().id,
                            deploymentId: runtime.getCurrentScript().deploymentId
                        })
                    });
                    return;
                }

                var resolvedUrl = url.resolveRecord({
                    recordType: 'customrecord_vs_customer_users',
                    recordId: recordId,
                    isEditMode: true
                });

                redirect.redirect({
                    url: resolvedUrl
                });
            } else if (context.request.method === 'GET') {
                var users = [];
                var userSearch = search.create({
                    type: "customrecord_vs_customer_users",
                    filters: [],
                    columns: [
                        search.createColumn({ name: "id", label: "ID" }),
                        search.createColumn({ name: "custrecord_vs_uc_customer", label: "Customer" }),
                        search.createColumn({ name: "custrecord_vs_uc_username", label: "Username" }),
                        search.createColumn({ name: "isinactive", label: "Inactive" })
                    ]
                });

                userSearch.run().each(function (result) {
                    users.push({
                        id: result.getValue({ name: 'id' }),
                        customer: result.getText({ name: 'custrecord_vs_uc_customer' }),
                        username: result.getValue({ name: 'custrecord_vs_uc_username' }),
                        inactive: result.getValue({ name: 'isinactive' })
                    });
                    return true;
                });

                var htmlFile = file.load({ id: 'External SO/VS_Admin_Page.html' });
                var htmlContent = htmlFile.getContents();
                htmlContent = htmlContent.replace('<!--USER_DATA_PLACEHOLDER-->', `<script>var userData = ${JSON.stringify(users)};</script>`);

                context.response.write(htmlContent);
            }
        }

        return { onRequest: onRequest };
    });
