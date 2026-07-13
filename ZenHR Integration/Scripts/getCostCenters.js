/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */
define(['N/search'], function(search) {
  function _get() {
    try{
      var searchQuery = search.create( {
        type: search.Type.ACCOUNT,
        columns: ['name', 'isinactive', 'type', 'subsidiary']
      });

      var resultSet = getAllResults(searchQuery)

      log.debug("the accounts count: ", resultSet.length)
      return resultSet;
    }
    catch(exception){
      log.debug('SCRIPT STOPPED', exception);
      return {
        code : 404,
        message : 'Something went wrong! ' + exception
      };
    }
  }

  function getAllResults(searchQuery) {
    var results = searchQuery.run();
    var searchResults = [];
    var searchId = 0;
    do {
      var resultslice = results.getRange({ start: searchId, end: searchId + 1000 });
      resultslice.forEach(function(result) {
        searchResults.push({
          accountId: result.id,
          accountName: result.getValue('name'),
          isInactive: result.getValue('isinactive'),
          accountType: result.getValue('type'), 
          subsidiaryId: result.getValue('subsidiary')
        });
        searchId++;
      });
    } while (resultslice.length >= 1000);
    return searchResults;
  }

  return {
    get: _get,
  }
});
