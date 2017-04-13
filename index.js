'use strict';
/* eslint-disable no-console */
const R = require('ramda');

const desired = require('./lib/desired.js');

const clusterName = process.env.CLUSTER_NAME;
const serviceName = process.env.SERVICE_NAME;
const reqPerMinuteMax = process.env.MAX_REQUESTS;
const reqPerMinuteMin = process.env.MIN_REQUESTS;
const minTasks = process.env.MIN_TASKS;
const maxTasks = process.env.MAX_TASKS;
const dryRun = process.env.DRY_RUN;

const setTasks = taskNum => {
    const AWS = require('aws-sdk');
    AWS.config.region = 'eu-west-1';
    const ecs = new AWS.ECS();

    console.log('Setting number of tasks to ' + taskNum);
    if(dryRun) return;
    ecs.updateService({
        service: serviceName,
        cluster: clusterName,
        desiredCount: taskNum
    }, err => {
        if(err) console.error(err);
    });
};

const run = () => {
    desired({
        cluster: clusterName,
        service: serviceName,
        reqPerMinuteMax: reqPerMinuteMax,
        reqPerMinuteMin: reqPerMinuteMin
    }, (err, data) => {
        if(err) return console.error(err);
        const requiredTasks = R.clamp(minTasks, maxTasks, data.required);
        if(data.current != requiredTasks) {
            setTasks(requiredTasks);
        } else {
            console.log('No changes necessary');
        }
    });
};

run();
setInterval(run, 60 * 1000);
