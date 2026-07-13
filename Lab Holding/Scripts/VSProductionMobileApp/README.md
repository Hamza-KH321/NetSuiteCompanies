# VS Production Mobile App

## File Cabinet paths expected by the Suitelets

Upload the files to these File Cabinet paths by default:

- `SuiteScripts/VSProductionMobileApp/Util/LIB_VSP_External_Session.js`
- `SuiteScripts/VSProductionMobileApp/Util/LIB_VSP_Subscription_Check.js`

- `SuiteScripts/VSProductionMobileApp/Login/SL_VSP_External_Login.js`
- `SuiteScripts/VSProductionMobileApp/Login/VSP_Login.html`
- `SuiteScripts/VSProductionMobileApp/Login/VSP_Login.css`
- `SuiteScripts/VSProductionMobileApp/Login/VSP_Login.js`

- `SuiteScripts/VSProductionMobileApp/App/SL_VSP_External_App.js`
- `SuiteScripts/VSProductionMobileApp/App/Services/VSP_App_Service.js`
- `SuiteScripts/VSProductionMobileApp/App/Services/User_Service.js`
- `SuiteScripts/VSProductionMobileApp/App/Services/ProductionOrder_Service.js`
- `SuiteScripts/VSProductionMobileApp/App/Shared/VSP_Constants.js`
- `SuiteScripts/VSProductionMobileApp/App/SharedHeader/VSP_Header.css`
- `SuiteScripts/VSProductionMobileApp/App/SharedHeader/VSP_Header.js`
- `SuiteScripts/VSProductionMobileApp/App/SharedHeader/VSP_Common.css`
- `SuiteScripts/VSProductionMobileApp/App/Home/VSP_Home.html`
- `SuiteScripts/VSProductionMobileApp/App/Home/VSP_Home.js`
- `SuiteScripts/VSProductionMobileApp/App/ManageIngredients/VSP_ManageIngredients.html`
- `SuiteScripts/VSProductionMobileApp/App/ManageIngredients/VSP_ManageIngredients.js`

For SuiteBundle installs, set script parameter `custscript_vsp_portal_root_path_login` on the Login Suitelet deployment and `custscript_vsp_portal_root_path` on the App Suitelet deployment to the installed bundle folder, for example:

`SuiteBundles/Bundle 000000/VSProductionMobileApp`

The default path is `SuiteScripts/VSProductionMobileApp`.

## Suitelet deployments expected by the code

- Login Suitelet: `customscript_vsp_external_login`, deployment `customdeploy_vsp_external_login`
- App Suitelet: `customscript_vsp_external_app`, deployment `customdeploy_vsp_external_app`

Both deployments should be available externally.

## Custom records

### VS Production Users

Record ID: `customrecord_vs_production_users`

Fields:

- `custrecord_vs_employee_prod`: List/Record, Employee
- `custrecord_vs_password_prod`: Password
- `custrecord_vs_location_prod`: List/Record, Location
- `custrecord_vs_subsidiary_prod`: List/Record, Subsidiary

Login accepts employee email, employee entity ID, or employee internal ID.

### VS Production External Session

Record ID: `customrecord_vs_production_external_sess`

Fields:

- `custrecord_vs_user`: List/Record, `customrecord_vs_production_users`
- `custrecord_vs_session_token`: Free-Form Text
- `custrecord_vs_session_ip`: Free-Form Text
- `custrecord_vs_session_start`: Date/Time
- `custrecord_vs_session_end`: Date/Time
- `custrecord_vs_session_active`: Checkbox

### VS Production Order (used by Manage Ingredients)

Record ID: `customrecord_vs_prod_production_order`

Looked up by its `name` field (the Production Order Number, e.g. `FSO000682`).

Fields read:

- `name`: Production Order Number
- `custrecord_vs_prod_production_recipe`: List/Record, Recipe
- `custrecord_vs_prod_production_qty`: Order Quantity
- `custrecord_vs_prod_prodord_processinginf`: Order Notes (best-effort mapping &mdash; adjust `FIELD_PRODORD_NOTES` in `VSP_Constants.js` if this isn't the right field)

### VS Production Order Items (ingredient lines)

Record ID: `customrecord_vs_prod_prodorder_items`

Fields:

- `custrecord_vs_prod_productionorder`: List/Record, parent link back to `customrecord_vs_prod_production_order`
- `custrecord_vs_prod_prodorder_item`: List/Record, Item
- `custrecord_vs_production_prod_units`: List/Record, Units
- `custrecord_vs_prod_prodord_item_qtyrecip`: Float, Quantity Per Recipe (read-only "Qty (Recipe)" on the Manage Ingredients screen)
- `custrecord_vs_prod_prodord_item_qty`: Float, Quantity (editable "Input Qty" on the Manage Ingredients screen &mdash; this is the field the mobile app writes back to)
