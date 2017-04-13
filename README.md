# AWS ECS ALB Service Autoscaler

The AWS ECS ALB Service Autoscaler runs as it's own service on your ECS cluster, and automatically scales a given service based on the average number of requests hitting the alb for a service per desired task.

## Usage

In a cloudformation template, on the ECS cluster:
```yaml
  ServiceAutoscaler:
    Properties:
      Cluster: my-cluster-name
      DesiredCount: 1
      TaskDefinition: !Ref ServiceAutoscalerTaskDef
    Type: AWS::ECS::Service

  ServiceAutoscalerTaskDef:
    Properties:
      ContainerDefinitions:
      - Environment:
        - Name: CLUSTER_NAME
          Value: MY_CLUSTER_NAME
        - Name: SERVICE_NAME
          Value: MY_SERVICE_TO_SCALE_NAME
        - Name: MIN_TASKS
          Value: 2
        - Name: MAX_TASKS
          Value: 4
        - Name: MAX_REQUESTS
          Value: 60
        - Name: MIN_REQUESTS
          Value: 30
        Essential: true
        Image: !Sub trinitymirror/aws-ecs-alb-service-autoscaler:${Version}
        Memory: 200
        Cpu: 100
        Name: Autoscaler
    Type: AWS::ECS::TaskDefinition
```

## Optional environment variables:
`DRY_RUN=true` - Causes the container to not actually run any changes, just print to stdout what it would do.
