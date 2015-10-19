"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */
/* global describe */
/* global it */

var expect = require('expect.js');
var sinon = require('sinon');
var Promises = require('best-promise');
var qaControlServerPushReceiver = require('../lib/push-receiver.js');

var request = require('supertest');

var json_data={
  "ref": "refs/heads/master",
  "before": "19ae096690fcb48a9c7748858c4fa99ac0cb9668",
  "after": "e221111d8a249744818840b2d62f42199d5b13bf",
  "created": false,
  "deleted": false,
  "forced": false,
  "base_ref": null,
  "compare": "https://github.com/codenautas/mini-tools/compare/19ae096690fc...e221111d8a24",
  "commits": [
    {
      "id": "e221111d8a249744818840b2d62f42199d5b13bf",
      "distinct": true,
      "message": "empezando con qa-control",
      "timestamp": "2015-10-19T16:32:13-03:00",
      "url": "https://github.com/codenautas/mini-tools/commit/e221111d8a249744818840b2d62f42199d5b13bf",
      "author": {
        "name": "Emilio",
        "email": "emilioplatzer@gmail.com",
        "username": "emilioplatzer"
      },
      "committer": {
        "name": "Emilio",
        "email": "emilioplatzer@gmail.com",
        "username": "emilioplatzer"
      },
      "added": [
      ],
      "removed": [
      ],
      "modified": [
        "lib/mini-tools.js"
      ]
    }
  ],
  "head_commit": {
    "id": "e221111d8a249744818840b2d62f42199d5b13bf",
    "distinct": true,
    "message": "empezando con qa-control",
    "timestamp": "2015-10-19T16:32:13-03:00",
    "url": "https://github.com/codenautas/mini-tools/commit/e221111d8a249744818840b2d62f42199d5b13bf",
    "author": {
      "name": "Emilio",
      "email": "emilioplatzer@gmail.com",
      "username": "emilioplatzer"
    },
    "committer": {
      "name": "Emilio",
      "email": "emilioplatzer@gmail.com",
      "username": "emilioplatzer"
    },
    "added": [
    ],
    "removed": [
    ],
    "modified": [
      "lib/mini-tools.js"
    ]
  },
  "repository": {
    "id": 39782704,
    "name": "mini-tools",
    "full_name": "codenautas/mini-tools",
    "owner": {
      "name": "codenautas",
      "email": ""
    },
    "private": false,
    "html_url": "https://github.com/codenautas/mini-tools",
    "description": "mini tools for express and others",
    "fork": false,
    "url": "https://github.com/codenautas/mini-tools",
    "forks_url": "https://api.github.com/repos/codenautas/mini-tools/forks",
    "keys_url": "https://api.github.com/repos/codenautas/mini-tools/keys{/key_id}",
    "collaborators_url": "https://api.github.com/repos/codenautas/mini-tools/collaborators{/collaborator}",
    "teams_url": "https://api.github.com/repos/codenautas/mini-tools/teams",
    "hooks_url": "https://api.github.com/repos/codenautas/mini-tools/hooks",
    "issue_events_url": "https://api.github.com/repos/codenautas/mini-tools/issues/events{/number}",
    "events_url": "https://api.github.com/repos/codenautas/mini-tools/events",
    "assignees_url": "https://api.github.com/repos/codenautas/mini-tools/assignees{/user}",
    "branches_url": "https://api.github.com/repos/codenautas/mini-tools/branches{/branch}",
    "tags_url": "https://api.github.com/repos/codenautas/mini-tools/tags",
    "blobs_url": "https://api.github.com/repos/codenautas/mini-tools/git/blobs{/sha}",
    "git_tags_url": "https://api.github.com/repos/codenautas/mini-tools/git/tags{/sha}",
    "git_refs_url": "https://api.github.com/repos/codenautas/mini-tools/git/refs{/sha}",
    "trees_url": "https://api.github.com/repos/codenautas/mini-tools/git/trees{/sha}",
    "statuses_url": "https://api.github.com/repos/codenautas/mini-tools/statuses/{sha}",
    "languages_url": "https://api.github.com/repos/codenautas/mini-tools/languages",
    "stargazers_url": "https://api.github.com/repos/codenautas/mini-tools/stargazers",
    "contributors_url": "https://api.github.com/repos/codenautas/mini-tools/contributors",
    "subscribers_url": "https://api.github.com/repos/codenautas/mini-tools/subscribers",
    "subscription_url": "https://api.github.com/repos/codenautas/mini-tools/subscription",
    "commits_url": "https://api.github.com/repos/codenautas/mini-tools/commits{/sha}",
    "git_commits_url": "https://api.github.com/repos/codenautas/mini-tools/git/commits{/sha}",
    "comments_url": "https://api.github.com/repos/codenautas/mini-tools/comments{/number}",
    "issue_comment_url": "https://api.github.com/repos/codenautas/mini-tools/issues/comments{/number}",
    "contents_url": "https://api.github.com/repos/codenautas/mini-tools/contents/{+path}",
    "compare_url": "https://api.github.com/repos/codenautas/mini-tools/compare/{base}...{head}",
    "merges_url": "https://api.github.com/repos/codenautas/mini-tools/merges",
    "archive_url": "https://api.github.com/repos/codenautas/mini-tools/{archive_format}{/ref}",
    "downloads_url": "https://api.github.com/repos/codenautas/mini-tools/downloads",
    "issues_url": "https://api.github.com/repos/codenautas/mini-tools/issues{/number}",
    "pulls_url": "https://api.github.com/repos/codenautas/mini-tools/pulls{/number}",
    "milestones_url": "https://api.github.com/repos/codenautas/mini-tools/milestones{/number}",
    "notifications_url": "https://api.github.com/repos/codenautas/mini-tools/notifications{?since,all,participating}",
    "labels_url": "https://api.github.com/repos/codenautas/mini-tools/labels{/name}",
    "releases_url": "https://api.github.com/repos/codenautas/mini-tools/releases{/id}",
    "created_at": 1438011526,
    "updated_at": "2015-07-27T15:43:16Z",
    "pushed_at": 1445283181,
    "git_url": "git://github.com/codenautas/mini-tools.git",
    "ssh_url": "git@github.com:codenautas/mini-tools.git",
    "clone_url": "https://github.com/codenautas/mini-tools.git",
    "svn_url": "https://github.com/codenautas/mini-tools",
    "homepage": null,
    "size": 164,
    "stargazers_count": 0,
    "watchers_count": 0,
    "language": "JavaScript",
    "has_issues": true,
    "has_downloads": true,
    "has_wiki": true,
    "has_pages": false,
    "forks_count": 0,
    "mirror_url": null,
    "open_issues_count": 0,
    "forks": 0,
    "open_issues": 0,
    "watchers": 0,
    "default_branch": "master",
    "stargazers": 0,
    "master_branch": "master",
    "organization": "codenautas"
  },
  "pusher": {
    "name": "emilioplatzer",
    "email": "emilioplatzer@gmail.com"
  },
  "organization": {
    "login": "codenautas",
    "id": 9803082,
    "url": "https://api.github.com/orgs/codenautas",
    "repos_url": "https://api.github.com/orgs/codenautas/repos",
    "events_url": "https://api.github.com/orgs/codenautas/events",
    "members_url": "https://api.github.com/orgs/codenautas/members{/member}",
    "public_members_url": "https://api.github.com/orgs/codenautas/public_members{/member}",
    "avatar_url": "https://avatars.githubusercontent.com/u/9803082?v=3",
    "description": ""
  },
  "sender": {
    "login": "emilioplatzer",
    "id": 5725064,
    "avatar_url": "https://avatars.githubusercontent.com/u/5725064?v=3",
    "gravatar_id": "",
    "url": "https://api.github.com/users/emilioplatzer",
    "html_url": "https://github.com/emilioplatzer",
    "followers_url": "https://api.github.com/users/emilioplatzer/followers",
    "following_url": "https://api.github.com/users/emilioplatzer/following{/other_user}",
    "gists_url": "https://api.github.com/users/emilioplatzer/gists{/gist_id}",
    "starred_url": "https://api.github.com/users/emilioplatzer/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/emilioplatzer/subscriptions",
    "organizations_url": "https://api.github.com/users/emilioplatzer/orgs",
    "repos_url": "https://api.github.com/users/emilioplatzer/repos",
    "events_url": "https://api.github.com/users/emilioplatzer/events{/privacy}",
    "received_events_url": "https://api.github.com/users/emilioplatzer/received_events",
    "type": "User",
    "site_admin": false
  }
};

qaControlServerPushReceiver.repositoryOfProjects={
    "mini-tools": {}
}

describe("qa-control",function(){
    var server;
    before(function(){
        server = createServer();
    });
    it("reject receive without X-GitHub-Event",function(done){
        var agent=request(server);
        agent
            .post('/push/mini-tools')
            .type('json')
            .send(json_data)
            .expect(400)
            .expect('bad request. Missing X-GitHub-Event header')
            .end(done);
    });
    it("receive one push",function(done){
        var agent=request(server);
        agent
            .post('/push/mini-tools')
            .set('X-GitHub-Event','push')
            .set('content-type','application/json')
            .type('json')
            .send(json_data)
            .expect('ok: 2015-10-19T16:32:13-03:00')
            .end(function(err){
                if(err){
                    return done(err);
                }
                expect(qaControlServerPushReceiver.repositoryOfProjects['mini-tools'].timestamp).to.eql("2015-10-19T16:32:13-03:00");
                // expect(qaControl.projectControl.toBeCalledOnceUponATime).to.ok();
            });
    });
});

var express = require('express');

function createServer(dir, opts, fn) {
    
    var _serve = qaControlServerPushReceiver.serve(dir, opts);
    
    var app = express();
    
    app.listen();
    
    app.use(_serve);
    
    return app;
}
