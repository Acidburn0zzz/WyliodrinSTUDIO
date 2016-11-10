
"use strict";

var angular = require ('angular');
var $ = require ('jquery');

var settings = require ('settings');
require ('debug').enable (settings.debug);
var debug = require ('debug')('wyliodrin:lacy:DeviceNetworkController');

debug ('Loading');

module.exports = function ()
{
	var app = angular.module ('wyliodrinApp');


	app.controller('DeviceNetworkController', function($scope, $wydevice, $mdDialog){
		debug ('Registering');

		var devicesCache;
		var users = {};
		var ip = '';
		var port = 7000;
		var secureport = 22;


		$wydevice.on ('connection_timeout', function ()
		{
			console.log('on connection_timeout');
			// var message = $mdDialog.confirm()
		 //          .title($filter('translate')('DEVICE_CONNECTION_TIMEOUT'))
		 //          .ok($filter('translate')('TOOLBAR_SETUP'))
		 //          .cancel($filter('translate')('OK'));
		 //    $mdDialog.show(message).then(function() {
		 //      $wyapp.emit ('board');
		 //    }, function() {
		     	
		 //    });
		});

		$wydevice.on ('connection_error', function ()
		{
			console.log('on connection_error');
			// var message = $mdDialog.confirm()
		 //          .title($filter('translate')('DEVICE_CONNECTION_ERROR'))
		 //          .ok($filter('translate')('TOOLBAR_SETUP'))
		 //          .cancel($filter('translate')('OK'));
		 //    $mdDialog.show(message).then(function() {
		 //      $wyapp.emit ('board');
		 //    }, function() {
		     	
		 //    });
		});

		$wydevice.on ('connection_login_failed', function ()
		{
			console.log ('on connection_login_failed');
			// var message = $mdDialog.confirm()
		 //          .title($filter('translate')('DEVICE_CONNECTION_FAILED'))
		 //          .ok($filter('translate')('DEVICE_CONNECT'))
		 //          .cancel($filter('translate')('OK'));
		 //          // Should be a retry button???
		 //    $mdDialog.show(message).then(function() {
		 //      // $wyapp.emit ('board');
		 //      that.open ();
		 //    }, function() {
		     	
		 //    });
		});

		var network = {
			devices: function (devices){},
			getDevices: function (){return devicesCache;},
			connectDevice: function (device)
			{
				connect(device);
			},
			disconnectDevice: function (device)
			{
				$wydevice.disconnect ();
			},
			status: function (boardId, status){}
		};

		window.getNetwork  = function ()
		{
			return network;
		};

		$wydevice.on ('status', function (status)
		{
			console.log('on status ' + status);
			if (status === 'INSTALL')
			{
				// var message = $mdDialog.confirm()
			 //          .title($filter('translate')('DEVICE_QUESTION_INSTALL_SHELL'))
			 //          .ok($filter('translate')('DEVICE_INSTALL'))
			 //          .cancel($filter('translate')('PROJECT_SHELL'));
			 //    $mdDialog.show(message).then(function() {
			 //   		$wyapp.emit ('install');
			 //    }, function() {
			     	
			 //    });
			}
			else
			{
				network.status ('raspberrypi', status);
			}
		});

		var connect = function (device)
		{
			if (!device) device = {ip:'', port:7000, secureport:22};
			debug ('Connecting to '+device);
			if (device.platform === 'chrome')
			{
				//$scope.connection = 'chrome';
				$wydevice.connect ('', {type:'chrome'});
				// mixpanel.track ('SerialPort Connect',{
				// 	style:'chrome',
				// 	device: 'chrome'
				// });
			}
			else
			if (device.platform === 'serial')
			{
				//$scope.connection = device.ip;
				$wydevice.connect (device.ip);
				// mixpanel.track ('SerialPort Connect',{
				// 	style:'serial',
				// 	device: device.ip
				// });
			}
			else
			{
				//var scope = $scope;
				$mdDialog.show({
			      controller: function ($scope)
			      {
			      	$scope.device =
			      	{
			      		ip: (device.ip.length>0?device.ip:ip),
			      		port: (device.port >= 0?device.port:port),
			      		secureport: (device.secureport >= 0?device.secureport:secureport),
			      		username: users[(device.ip.length>0?device.ip:ip)] || '',
			      		category: device.category
			      	};

			      	//$scope.device.secure = true;

			      	this.connect = function ()
			      	{
			      		// device.ip = $scope.device.ip;
			      		// device.port = $scope.device.port;
			      		users[$scope.device.ip] = $scope.device.username;
			      		ip = $scope.device.ip;
			      		port = $scope.device.port;
			      		var type = 'chrome-socket';
			      		if ($scope.device.secure) 
			      		{
			      			type = 'chrome-ssh';
			      			port = $scope.device.secureport;
			      		}
			      		//scope.connection = ip;
			      		$wydevice.connect ($scope.device.ip, {type:type, port: port, username:$scope.device.username, password:$scope.device.password, category:device.category, platform: device.platform});
			      		$mdDialog.hide ();
			      		// mixpanel.track ('SerialPort Connect', {
			      		// 	style: 'address',
			      		// 	type: type
			      		// });
			      	};

			      	this.exit = function ()
			      	{
			      		$mdDialog.hide ();
			      	};
			      },
			      controllerAs: 'a',
			      templateUrl: '/public/views/authenticate.html',
			      escapeToClose: false,
			      clickOutsideToClose: false,
			      fullscreen: false
			    });
			}

		};


		var getDevices = function ()
		{
			$wydevice.registerForNetworkDevices (function (devices){
				devicesCache = devices;
				network.devices();
			});
		};
		setTimeout(getDevices, 1000);
	});
};
