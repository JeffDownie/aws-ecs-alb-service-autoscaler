'use strict';
const R = require('ramda');
const AWS = require('aws-sdk');
AWS.config.region = 'eu-west-1';

const getElbCloudwatchName = R.compose(R.head, R.match(/app\/[^\/]*\/[^\/]*$/));

module.exports = (params, cb) => {
    const elb = new AWS.ELBv2();
    const ecs = new AWS.ECS();
    const cw = new AWS.CloudWatch();

    const cluster = params.cluster;
    const service = params.service;
    const reqPerMinuteMax = params.reqPerMinuteMax;
    const reqPerMinuteMin = params.reqPerMinuteMin;
    const latencyMin = params.latencyMin;
    const latencyMax = params.latencyMax;

    if(reqPerMinuteMin >= reqPerMinuteMax) return cb('minimum requests per minuite must be less that maximum req per minuite');

    if(!cluster || !service || R.isNil(reqPerMinuteMax) || R.isNil(reqPerMinuteMin)) return cb('Required parameter not set in call to autoscaler.');

    ecs.describeServices({
        cluster: params.cluster,
        services: [params.service]
    }, (err, data) => {
        if(err) return cb(err);
        const currentDesired = R.prop('desiredCount' ,data.services[0]);
        elb.describeTargetGroups({
            TargetGroupArns: [data.services[0].loadBalancers[0].targetGroupArn],
            PageSize: 1
        }, (err, data) => {
            if(err) return cb(err);
            const cwMetric = getElbCloudwatchName(data.TargetGroups[0].LoadBalancerArns[0]);
            cw.getMetricStatistics({
                EndTime: new Date(),
                MetricName: 'RequestCount',
                Namespace: 'AWS/ApplicationELB',
                StartTime: new Date(new Date().getTime() - 10*60000),
                Dimensions:[{
                    Name: 'LoadBalancer',
                    Value: cwMetric
                }],
                Period: 60,
                Statistics: ['Sum']
            }, (err, data) => {
                if(err) return cb(err);
                if(data.Datapoints.length === 0) return cb('No datapoints!');
                const reqPerMin = R.mean(R.map(R.prop('Sum'), data.Datapoints)) / currentDesired;
                cw.getMetricStatistics({
                    EndTime: new Date(),
                    MetricName: 'TargetResponseTime',
                    Namespace: 'AWS/ApplicationELB',
                    StartTime: new Date(new Date().getTime() - 1*60000),
                    Dimensions:[{
                        Name: 'LoadBalancer',
                        Value: cwMetric
                    }],
                    Period: 60,
                    Statistics: ['Average']
                }, (err, data) => {
                    if(!data.Datapoints[0]) return cb('No datapoints!');
                    const latency = data.Datapoints[0].Average;
                    let desired = currentDesired;

                    if((reqPerMin > reqPerMinuteMax) || (latencyMax && (latency > latencyMax))) {
                        desired++;
                    } else if((reqPerMin < reqPerMinuteMin) && (!latencyMin || (latency < latencyMin))) {
                        desired--;
                    }
                    cb(null, {
                        current: currentDesired,
                        required: desired
                    });
                });
            });
        });
    });
};
