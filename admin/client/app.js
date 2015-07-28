var logAnalyzer = angular.module("la", ["ngRoute", "ui.bootstrap"]);

var selectedTitle = "";

// This  maps URLS/Routes to pages and controllers
logAnalyzer.config(["$routeProvider", "$locationProvider", "$httpProvider",
    function($routeProvider, $locationProvider, $httpProvider) {
        $locationProvider.html5Mode(true);
        $routeProvider
            .when("/logAnalyzer", {
                templateUrl: "/client/templates/home.html",
                controller: "homeController"
            })
            .when("/logAnalyzer/viewLog", {
                templateUrl: "/client/templates/viewLog.html",
                controller: "logViewController"
            })
            .otherwise({
                redirectTo: "/"
            });
    }
]);

// This is the main controller that drives the side menu
logAnalyzer.controller("rootController", function($scope, $http, $location) {
    $scope.isLogin = false;
    if (!$scope.isLogin) {
        var navs = [{
            "name": "Home",
            "url": "/logAnalyzer",
            "isActive": true
        }]
        $scope.navs = navs;
    }

    $scope.onNavSwitch = function(nav) {
        _.each($scope.navs, function(nav) {
            nav.isActive = false;
            closeChildren(nav);
        });
        nav.isActive = true;
        selectedTitle = nav.name;
    };

    $scope.onCollapse = function(header) {
      header.collapsed = !header.collapsed;
    }

    // Recursively close every child nav (for multiple nested menus)
    var closeChildren = function(nav) {
      if(nav.submenu) {
        _.each(nav.submenu, function(subnav) {
          subnav.isActive = false;
          closeChildren(subnav);
        })
      } else {
        return;
      }
    }
});

logAnalyzer.filter('noSpace', function() {
  return function(input) {
    if(input) {
      return input.split(' ').join('-');
    }
  }
});

// This is the home controller
logAnalyzer.controller("homeController", function($scope, $http) {

  //For padding single digit months/days
  function toTwoDigits(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  $scope.datePick = {
    dateSelected : new Date(),
    dateString : function() {
      return this.dateSelected.getFullYear() + '-' + toTwoDigits((this.dateSelected.getMonth() + 1)) + '-' + toTwoDigits(this.dateSelected.getDate());
    }
  };

  //Opening the date picker
  $scope.open = function($event) {
    $event.preventDefault();
    $event.stopPropagation();

    $scope.opened = true;
  };


});

// This is the log view controller
logAnalyzer.controller("logViewController", ['$scope', '$http', '$routeParams', function($scope, $http, $routeParams) {
  $scope.date = $routeParams.date;
  $scope.logData;
  $scope.splitData;
  $scope.currentData;
  $scope.showSpinner = true;
  $scope.fileName = '';
  $scope.searchVal = '';
  $scope.startIndex = 0;
  $scope.endIndex = 500;

  var today = new Date();
  var dateParsed = $scope.date.split('-');
  //If the query is for today, then name is just cmsp.log.  Otherwise, cmsp.log-<yyyyMMdd>.gz
  if(parseInt(dateParsed[0]) == today.getFullYear() && parseInt(dateParsed[1]) == today.getMonth() + 1 && parseInt(dateParsed[2]) == today.getDate()) {
      $scope.fileName = 'cmsp.log';
  } else {
    $scope.fileName = 'cmsp.log' + '-' + dateParsed[0] + dateParsed[1] + dateParsed[2] + '.gz';
  }

  $scope.getLogs = function() {
    $scope.logData = 'Loading...';
    $http.get("/getFiles?file=" + $scope.fileName).then(function(response) {
      if(response && response.data) {
        //Log and return on server error.
        if(response.data.status && response.data.status == "Error") {
          $scope.logData = response.data.result;
          return;
        }
        $scope.receivedData = response.data;

        var splitRegex = /\n(?:(?=\d*-\d*-\d*))/;
        $scope.splitData = response.data.split(splitRegex);
        $scope.currentData = $scope.splitData.slice();

        $scope.logData = $scope.currentData.slice(0, 500).join('\n');
      }
    })
    .catch(function(err) {

    })
    .finally(function() {

    });

  }

  $scope.reverseOrder = function() {
    $scope.currentData.reverse();

    $scope.logData = $scope.currentData.slice($scope.startIndex, $scope.endIndex).join('\n');

  }

  $scope.search = function(searchVal) {
    var searchData = $scope.splitData.slice();
    for(var i = 0; i < searchData.length; i++) {
      if(searchData[i].indexOf(searchVal) < 0) {
        searchData.splice(i, 1);
        i = i - 1;
      }
    }
    $scope.currentData = searchData;
    $scope.startIndex = 0;
    $scope.endIndex = 500;
    $scope.logData = $scope.currentData.slice($scope.startIndex, $scope.endIndex).join('\n');

  }

  $scope.next = function() {
    if($scope.endIndex < $scope.currentData.length) {
      $scope.startIndex = $scope.endIndex;
      $scope.endIndex = Math.min($scope.endIndex + 500, $scope.currentData.length);
      $scope.logData = $scope.currentData.slice($scope.startIndex, $scope.endIndex).join('\n');
    }
  }

  $scope.previous = function() {
    if($scope.startIndex > 0) {
      $scope.endIndex = $scope.startIndex - 1;
      $scope.startIndex = Math.max(0, $scope.startIndex - 500);
      $scope.logData = $scope.currentData.slice($scope.startIndex, $scope.endIndex).join('\n');
    }

  }

  $scope.getLogs();

}]);
