//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//
'use strict';

/* jshint unused: false */

var __ = require('underscore');
var util = require('util');
var wrap = require('wordwrap').hard(0, 75);

var tokenCache = require('../util/authentication/adalAuth').tokenCache;
var profile = require('../util/profile');
var utils = require('../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  cli.command('login')
    .description($('Log in to an Azure subscription using Active Directory'))
    .option('-e --environment [environment]', $('Environment to authenticate against, must support active directory'))
    .option('-u --user <username>', $('user name, will prompt if not given'))
    .option('-p --password <password>', $('user password, will prompt if not given'))
    .option('-q --quiet', $('do not prompt for confirmation of PII storage'))
    .execute(function(options, _) {

      var piiWarningText = wrap($('If you choose to continue, Azure command-line interface will cache your ' +
        'authentication information. Note that this sensitive information will be stored in ' +
        'plain text on the file system of your computer at %s. Ensure that you take suitable ' +
        'precautions to protect your computer from unauthorized access in order to minimize the ' +
        'risk of that information being disclosed.' +
        '\nDo you wish to continue: (y/n) '));

      var environmentName = options.environment || 'AzureCloud';
      var environment = profile.current.getEnvironment(environmentName);
      if (!environment) {
        throw new Error(util.format($('Unknown environment %s'), environmentName));
      }

      if (!options.hasOwnProperty('password')) {
        options.password = undefined;
      }

      var username = cli.interaction.promptIfNotGiven('Username: ', options.user, _);

      if (!tokenCache.isSecureCache) {
        var haveSeenBefore = __.values(profile.current.subscriptions).some(function (s) {
          return utils.ignoreCaseEquals(username, s.username);
        });

        if (!options.quiet && !haveSeenBefore) {
          if (!cli.interaction.confirm(util.format(piiWarningText, profile.defaultProfileFile), _)) {
            log.info($('Login cancelled'));
            return;
          }
        }
      }

      var password = cli.interaction.promptPasswordOnceIfNotGiven('Password: ', options.password, _);

      var progress = cli.interaction.progress($('Authenticating...'));
      try {
        var newSubscriptions = environment.addAccount(username, password, _);
        if (newSubscriptions.length > 0) {
          newSubscriptions[0].isDefault = true;

          newSubscriptions.forEach(function (s) {
            profile.current.addSubscription(s);
            log.info(util.format($('Added subscription %s'), s.name));
            if (s.isDefault) {
              log.info(util.format($('Setting subscription %s as default'), s.name));
            }
          });
          profile.current.save();
        } else {
          log.info(util.format($('No subscriptions found for this login')));
        }
      } finally {
        progress.end();
      }
    });

  cli.command('logout [username]')
    .description($('Log out from Azure subscription using Active Directory'))
    .option('-u --username <username>', $('Required. User name used to log out from Azure Active Directory.'))
    .execute(function (username, options, _) {
    if (!username){
      return cli.missingArgument('username');
    }
    if (profile.current.logoutUser(username, _)) {
      profile.current.save();
      log.info($('You have logged out.'));
    } else {
      log.info(util.format($('You are not logging in as \'%s\'. Quitting.'), username));
    }
  });
};
