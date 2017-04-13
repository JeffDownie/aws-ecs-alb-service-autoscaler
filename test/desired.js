'use strict';
require('should');
const R = require('ramda');
const desired = require('../lib/desired.js');

const AWS = require('aws-sdk-mock');

const mockServices = (clusterName, serviceName, desiredCount, targetGroupArn) => {
    AWS.mock('ECS', 'describeServices', (params, cb) => {
        params.cluster.should.be.equal(clusterName);
        params.services.should.be.deepEqual([serviceName]);
        cb(null, {services: [{
            desiredCount: desiredCount,
            loadBalancers: [{
                targetGroupArn: targetGroupArn
            }]
        }]});
    });
};
const mockTargets = (targetGroupArn, loadBalancerArn) => {
    AWS.mock('ELBv2', 'describeTargetGroups', (params, cb) => {
        params.PageSize.should.be.equal(1);
        params.TargetGroupArns.should.be.deepEqual([targetGroupArn]);
        cb(null, {TargetGroups:[{
            LoadBalancerArns: [loadBalancerArn]
        }]});
    });
};
const mockStatistics = (loadBalancerMetricValue, stats) => {
    AWS.mock('CloudWatch', 'getMetricStatistics', (params, cb) => {
        params.Dimensions.should.be.deepEqual([{Name: 'LoadBalancer', Value:loadBalancerMetricValue}]);
        cb(null, {Datapoints: stats});
    });
};

afterEach(() => {
    AWS.restore();
});

it('should exist', () => {
    desired.should.be.ok();
    desired.should.be.a.Function();
});
it('should work if there have been no requests in the dataset', done => {
    mockServices('test-cluster', 'test-service', 1, 'test-target-arn');
    mockTargets('test-target-arn', 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test-load-balancer/12345abcde');
    mockStatistics('app/test-load-balancer/12345abcde', R.repeat({Sum: 0}, 10));
    desired({
        cluster: 'test-cluster',
        service: 'test-service',
        reqPerMinuteMax: 1,
        reqPerMinuteMin: 0.5
    }, (err, data) => {
        if(err) return done(err);
        data.should.be.deepEqual({
            current: 1,
            required: 0
        });
        done();
    });
});
it('should raise the number of required services when necessary', done => {
    mockServices('test-cluster', 'test-service', 3, 'test-target-arn');
    mockTargets('test-target-arn', 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test-load-balancer/12345abcde');
    mockStatistics('app/test-load-balancer/12345abcde', R.repeat({Sum: 4}, 5));
    desired({
        cluster: 'test-cluster',
        service: 'test-service',
        reqPerMinuteMax: 1,
        reqPerMinuteMin: 0.5
    }, (err, data) => {
        if(err) return done(err);
        data.should.be.deepEqual({
            current: 3,
            required: 4
        });
        done();
    });
});
it('should lower the number of required services when necessary', done => {
    mockServices('test-cluster', 'test-service', 3, 'test-target-arn');
    mockTargets('test-target-arn', 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test-load-balancer/12345abcde');
    mockStatistics('app/test-load-balancer/12345abcde', R.repeat({Sum: 1.4}, 10));
    desired({
        cluster: 'test-cluster',
        service: 'test-service',
        reqPerMinuteMax: 1,
        reqPerMinuteMin: 0.5
    }, (err, data) => {
        if(err) return done(err);
        data.should.be.deepEqual({
            current: 3,
            required: 2
        });
        done();
    });
});
it('should work for a varying set of incoming requests', done => {
    mockServices('test-cluster', 'test-service', 3, 'test-target-arn');
    mockTargets('test-target-arn', 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test-load-balancer/12345abcde');
    mockStatistics('app/test-load-balancer/12345abcde', [{Sum:50},{Sum:1},{Sum:400}]);
    desired({
        cluster: 'test-cluster',
        service: 'test-service',
        reqPerMinuteMax: 50,
        reqPerMinuteMin: 30
    }, (err, data) => {
        if(err) return done(err);
        data.should.be.deepEqual({
            current: 3,
            required: 4
        });
        done();
    });
});
