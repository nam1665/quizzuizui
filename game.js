var fbGame = {
    permissions: ['user_posts', 'user_friends'],
    spinner: new Spinner({ color: "#0092D3", length: 30, width: 10 }),
    isShareTracked: false,
    isDataReady: false,
    data: { id: null, name: null, first_name: null, gender: null, avatar: null, fScores: null, fNames: null, match: null }
};

fbGame.init = function () {
    $('#replay').click(function () {
        $('#game-pq').hide();
        $("#game-loading").fadeIn(300);
        fbGame.spinner.spin($("#game-spin")[0]);
        fbGame.loadData();
    });

    $('#shareResult').click(function () {
        if (!fbGame.isShareTracked) {
            fbGame.isShareTracked = true;
            ga('send', 'event', 'Html', 'Share Result', _titleUrl_, { 'nonInteraction': 1 });
            fbq('trackCustom', 'Share Html Result', { post: _titleUrl_ });
        }

        var info = fbGame.getShareInfo();
        console.log('img = ' + info.img);
        info.caption = $("<textarea/>").html(info.caption).text();
        if (info.img.endsWith(".jpg")) {
            FB.ui({
                method: 'feed',
                link: bla.fb.sallUrl(info.url, info.caption, info.desc, info.img),
                picture: info.img,
                description: info.desc
            }, function (res) {
                bla.common.countUrlTitle(_titleUrl_);
            });
        } else {
            bla.fb.feed(info.url, info.caption, info.desc, info.img, function () {
                bla.common.countUrlTitle(_titleUrl_);
            });
        }
    });

    $('#view-result').click(function () {
        $('#input').hide();
        $("#game-loading").fadeIn(300);
        fbGame.spinner.spin($("#game-spin")[0]);
        fbq('trackCustom', 'Play Html', { post: _titleUrl_ });
        fbGame.loadData();
        afg.removeAds();
    });

    $('#input').hide();
    $("#game-loading").fadeIn(300);
    fbGame.spinner.spin($("#game-spin")[0]);

    console.log('auth = ' + bla.common.getParam('auth'));

    if (bla.common.getParam('auth') === '1' && bla.common.getParam('error') === undefined) {
        fbGame.loadData();
    }
    else {
        fbGame.checkLogin();
        fbGame.spinner.stop();
        $("#game-loading").hide();
        $('#input').show();
        if (Math.random() < _afgPercent_ && bla.common.getParam('ref') !== 'fba')
            setTimeout(afg.showAds, 500);
    }
};

fbGame.checkLogin = function () {
    if ($('#viewResultLabel').length == 0)
        return;

    if (!bla.fb.sdkReady) {
        setTimeout(function () { fbGame.checkLogin(); }, 100);
        return;
    }

    FB.getLoginStatus(function (response) {
        console.log(response.status);
        if (response.status !== 'connected') {
            $('#viewResultLabel').show();
            $('#loginText').html('Login with Facebook');
        }
    });
};

fbGame.loadData_Me = function (options) {
    if (!bla.fb.sdkReady) {
        console.log("sdk not ready");
        setTimeout(function () { fbGame.loadData_Me(options); }, 300);
        return;
    }

    options = options || {};
    options.avaWidth = options.avaWidth || 200;
    options.avaHeight = options.avaHeight || 200;

    FB.getLoginStatus(function (response) {
        console.log(response.status);
        if (response.status === 'connected') {
            FB.api('/me?fields=id,name,first_name,gender,picture.width(' + options.avaWidth + ').height(' + options.avaHeight + ')', function (response) {
                console.log(response);
                fbGame.data.id = response.id;
                fbGame.data.name = response.name;
                fbGame.data.first_name = response.first_name;
                fbGame.data.gender = response.gender;
                fbGame.data.avatar = response.picture.data.url.replace('https:', 'http:');

                setTimeout(fbGame.onDataReady, 3500);
            });
        } else {
            fbGame.redirectToLogin();
        }
    });
};

fbGame.loadData_MeAndFriends = function (take, inTop, options) {
    if (!bla.fb.sdkReady) {
        console.log("sdk not ready");
        setTimeout(function () { fbGame.loadData_MeAndFriends(take, inTop, options); }, 300);
        return;
    }

    options = options || {};
    options.avaWidth = options.avaWidth || 200;
    options.avaHeight = options.avaHeight || 200;

    if (fbGame.isDataReady) {
        setTimeout(function () { fbGame.findFriends(take, inTop, options); }, 2000);
        return;
    }

    FB.getLoginStatus(function (response) {
        if (!response || response.error) {
            fbGame.handleError();
            return;
        }

        console.log('login status = ' + response.status);
        if (response.status === 'connected') {
            FB.api('/me/permissions', function (response) {
                if (!response || response.error || !response.data) {
                    fbGame.handleError();
                    return;
                }

                var enoughPer = true;
                fbGame.permissions.forEach(function (req) {
                    var granted = false;
                    response.data.forEach(function (p) {
                        if (p.status === 'granted' && p.permission === req) {
                            granted = true;
                            return;
                        }
                    });
                    enoughPer = enoughPer && granted;
                });
                console.log('enough permissions = ' + enoughPer);
                if (!enoughPer) {
                    fbGame.redirectToLogin();
                    return;
                }

                FB.api('/me/posts?limit=20&fields=likes.limit(100){id,name},comments.limit(100){from{id,name}}', function (response) {
                    if (!response || response.error) {
                        fbGame.handleError();
                        return;
                    }

                    fbGame.data.fScores = {};
                    fbGame.data.fNames = {};
                    if (response.data) {
                        response.data.forEach(function (post) {
                            if (post.likes && post.likes.data) {
                                post.likes.data.forEach(function (like) {
                                    if (fbGame.data.fScores.hasOwnProperty(like.id))
                                        fbGame.data.fScores[like.id] += 1;
                                    else {
                                        fbGame.data.fScores[like.id] = 1;
                                        fbGame.data.fNames[like.id] = like.name;
                                    }
                                });
                            }
                            if (post.comments && post.comments.data) {
                                post.comments.data.forEach(function (cmt) {
                                    if (cmt.from)
                                        if (fbGame.data.fScores.hasOwnProperty(cmt.from.id))
                                            fbGame.data.fScores[cmt.from.id] += 3;
                                        else {
                                            fbGame.data.fScores[cmt.from.id] = 3;
                                            fbGame.data.fNames[cmt.from.id] = cmt.from.name;
                                        }
                                });
                            }
                        });
                    }

                    FB.api('/me?fields=id,name,first_name,gender,friends.limit(20){id,name},picture.width(' + options.avaWidth + ').height(' + options.avaHeight + ')', function (response) {
                        if (!response || response.error) {
                            fbGame.handleError();
                            return;
                        }

                        fbGame.data.id = response.id;
                        fbGame.data.name = response.name;
                        fbGame.data.first_name = response.first_name;
                        fbGame.data.gender = response.gender;
                        fbGame.data.avatar = response.picture.data.url.replace('https:', 'http:');
                        fbGame.data.fNames[fbGame.data.id] = fbGame.data.name;

                        console.log('user info = ' + fbGame.data.id + ' | ' + fbGame.data.name + ' | ' + fbGame.data.first_name + ' | ' + fbGame.data.gender);

                        if (response.friends && response.friends.data) {
                            response.friends.data.forEach(function (f) {
                                if (!fbGame.data.fScores.hasOwnProperty(f.id)) {
                                    fbGame.data.fScores[f.id] = 0;
                                    fbGame.data.fNames[f.id] = f.name;
                                }
                            });
                        }

                        fbGame.isDataReady = true;
                        fbGame.findFriends(take, inTop, options);
                    });
                });
            });
        } else {
            fbGame.redirectToLogin();
        }
    });
};

fbGame.findFriends = function (take, inTop, options) {
    var sortable = [];
    for (var fid in fbGame.data.fScores)
        if (fid != fbGame.data.id) sortable.push([fid, fbGame.data.fScores[fid]]);
    sortable.sort(function (a, b) { return b[1] - a[1] });
    var topScores = sortable.slice(0, inTop);
    fbGame.data.match = {};

    if (topScores.length > 0) {
        fbGame.data.match.ids = [];
        fbGame.data.match.names = [];
        fbGame.data.match.first_names = [];
        fbGame.data.match.avatars = [];

        var ids = '';
        while (fbGame.data.match.ids.length < take && topScores.length > 0) {
            var index = Math.floor(Math.random() * topScores.length);
            fbGame.data.match.ids.push(topScores[index][0]);
            fbGame.data.match.names.push(fbGame.data.fNames[topScores[index][0]]);
            ids += topScores[index][0] + ',';
            topScores.splice(index, 1);
        }

        ids = ids.substr(0, ids.length - 1);

        FB.api('/?ids=' + ids + '&fields=first_name,picture.width(' + options.avaWidth + ').height(' + options.avaHeight + ')', function (response) {
            fbGame.data.match.ids.forEach(function(id) {
                fbGame.data.match.first_names.push(response[id].first_name);
                fbGame.data.match.avatars.push(response[id].picture.data.url.replace('https:', 'http:'));
            });

            fbGame.data.match.id = fbGame.data.match.ids[0];
            fbGame.data.match.name = fbGame.data.match.names[0];
            fbGame.data.match.first_name = fbGame.data.match.first_names[0];
            fbGame.data.match.avatar = fbGame.data.match.avatars[0];

            console.log(fbGame.data.match);

            setTimeout(fbGame.onDataReady, 2500);
        });
    } else {
        fbGame.onDataReady();
    }
};

fbGame.friendNotFound = function () {
    $("#result-desc").html("<div style='padding: 50px 10px;text-align: center;'>It seems you have too few friends on Facebook so we can't analyze. We're sorry. :(</div>");
    $("#shareResult").remove();
    fbGame.spinner.stop();
    $("#game-loading").hide();
    $('#game-pq').fadeIn(300);
};

fbGame.redirectToLogin = function () {
    var loginUrl = _gameUrl_ + '?auth=1';
    var ref = bla.common.getParam('ref');
    var sall = bla.common.getParam('sall');
    if (ref != undefined)
        loginUrl += '&ref=' + ref;
    else if (sall != undefined)
        loginUrl += '&ref=rs';
    var per = '';
    fbGame.permissions.forEach(function (p) { per += p + ',' });
    if (per.length > 0) per = per.substr(0, per.length - 1);
    window.location.href = bla.fb.getLoginUrl(loginUrl, per);
};

fbGame.handleError = function () {
    fbGame.spinner.stop();
    $("#game-loading").hide();
    $('#input').show();
};
