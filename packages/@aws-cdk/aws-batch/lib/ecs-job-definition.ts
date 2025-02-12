import { ArnFormat, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnJobDefinition } from 'aws-cdk-lib/aws-batch';
import { EcsEc2ContainerDefinition, IEcsContainerDefinition } from './ecs-container-definition';
import { baseJobDefinitionProperties, IJobDefinition, JobDefinitionBase, JobDefinitionProps } from './job-definition-base';

/**
 * A JobDefinition that uses ECS orchestration
 */
interface IEcsJobDefinition extends IJobDefinition {
  /**
   * The container that this job will run
   */
  readonly container: IEcsContainerDefinition

  /**
   * Whether to propogate tags from the JobDefinition
   * to the ECS task that Batch spawns
   *
   * @default false
   */
  readonly propagateTags?: boolean;
}

/**
 * @internal
 */
export enum Compatibility {
  EC2 = 'EC2',
  FARGATE = 'FARGATE',
}

/**
 * Props for EcsJobDefinition
 */
export interface EcsJobDefinitionProps extends JobDefinitionProps {
  /**
   * The container that this job will run
   */
  readonly container: IEcsContainerDefinition

  /**
   * Whether to propogate tags from the JobDefinition
   * to the ECS task that Batch spawns
   *
   * @default false
   */
  readonly propagateTags?: boolean;
}

/**
 * A JobDefinition that uses ECS orchestration
 *
 * @resource AWS::Batch::JobDefinition
 */
export class EcsJobDefinition extends JobDefinitionBase implements IEcsJobDefinition {
  /**
   * Import a JobDefinition by its arn.
   */
  public static fromJobDefinitionArn(scope: Construct, id: string, jobDefinitionArn: string): IJobDefinition {
    const stack = Stack.of(scope);
    const jobDefinitionName = stack.splitArn(jobDefinitionArn, ArnFormat.SLASH_RESOURCE_NAME).resourceName!;

    class Import extends JobDefinitionBase implements IEcsJobDefinition {
      public readonly jobDefinitionArn = jobDefinitionArn;
      public readonly jobDefinitionName = jobDefinitionName;
      public readonly enabled = true;
      container = {} as any;
    }

    return new Import(scope, id);
  }

  readonly container: IEcsContainerDefinition
  public readonly propagateTags?: boolean;

  public readonly jobDefinitionArn: string;
  public readonly jobDefinitionName: string;

  constructor(scope: Construct, id: string, props: EcsJobDefinitionProps) {
    super(scope, id, props);

    this.container = props.container;
    this.propagateTags = props?.propagateTags;

    const resource = new CfnJobDefinition(this, 'Resource', {
      ...baseJobDefinitionProperties(this),
      type: 'container',
      jobDefinitionName: props.jobDefinitionName,
      containerProperties: this.container?._renderContainerDefinition(),
      platformCapabilities: this.renderPlatformCapabilities(),
      propagateTags: this.propagateTags,
    });

    this.jobDefinitionArn = this.getResourceArnAttribute(resource.ref, {
      service: 'batch',
      resource: 'job-definition',
      resourceName: this.physicalName,
    });
    this.jobDefinitionName = this.getResourceNameAttribute(resource.ref);
  }

  private renderPlatformCapabilities() {
    if (this.container instanceof EcsEc2ContainerDefinition) {
      return [Compatibility.EC2];
    }

    return [Compatibility.FARGATE];
  }
}
