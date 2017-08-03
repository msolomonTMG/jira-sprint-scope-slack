'use strict';

const
  express = require('express'),
  bodyParser = require('body-parser'),
  request = require('request');

var app = express();
app.set('port', process.env.PORT || 5000);

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

app.post('/jira-issue-added-to-sprint', function(req, res) {
  let issue = req.body.issue,
      changelog = req.body.changelog,
      user = req.body.user,
      jiraURL = issue.self.split('/rest/api')[0];

  let sprintChanged = changelog.items.find(item => item.field === "Sprint")

  let addedToFutureSprint = determineFutureSprint(issue.fields.customfield_10016)

  if (!sprintChanged) {

    console.log('No Sprint change')
    res.sendStatus(200)

  } else if (sprintChanged.to === "") {

    console.log(`${issue.key} removed from ${sprintChanged.fromString}`)
    res.sendStatus(200)

  } else if (addedToFutureSprint) {

    console.log(`${issue.key} added to future sprint`)
    res.sendStatus(200)

  } else {

    console.log(`${issue.key} added to ${sprintChanged.toString}`)

    let postData = {
      text: `${user.displayName} added ${issue.key} to ${sprintChanged.toString}`,
      attachments: [
        {
          fallback: `${user.displayName} added <${jiraURL}/browse/${issue.key}|${issue.key}: ${issue.fields.summary}> to ${sprintChanged.toString}`,
          color: 'danger',
          title: `<${jiraURL}/browse/${issue.key}|${issue.key}: ${issue.fields.summary}>`,
          thumb_url: `${user.avatarUrls["48x48"]}`,
          fields: [
            {
              title: "Type",
              value: `${issue.fields.issuetype.name}`,
              short: true
            },
            {
              title: "Story Points",
              value: `${issue.fields.customfield_10021}`,
              short: true
            },
            {
              title: "Priority",
              value: `${issue.fields.priority.name}`,
              short: true
            },
            {
              title: "Labels",
              value: issue.fields.labels.join(', '),
              short: true
            }
          ]
        }
      ]
    }

    let options = {
      method: 'post',
      body: postData,
      json: true,
      url: process.env.SLACK_URL
    }

    request(options, function(err, response, body) {
      if (err) {
        console.error('error posting json: ', err)
      } else {
        console.log('alerted Slack')
        res.sendStatus(200)
      }
    })

  }

  /*
   * Take an array of sprints (strings) and if you find one where state=future
   * then return true. I'm not sure if an issue can belong to an active sprint
   * as well as a future sprint. If that's the case, then this function needs
   * refactoring.
  */
  function determineFutureSprint(sprints) {
    // its possible there are no sprints
    if (!sprints) {
      return false
    }

    for (let i=0; i < sprints.length; i++) {

      if (sprints[i].includes('state=FUTURE')) {
        return true
      } else if (i === sprints.length - 1) {
        return false
      }

    }

  }
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
module.exports = app;
