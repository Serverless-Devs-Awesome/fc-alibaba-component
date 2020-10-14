import React, { useState, useEffect, Fragment, useContext } from 'react';
import { isEmpty } from 'lodash';
import { Grid } from '@alicloud/console-components';

import { UserContext } from '../../context'
import Calls from './Calls';
import { TotalCalls, StateProportion, LineChart, QualifierDestination } from './Chart';
import { getMetricData } from '../../request';
import './index.css'
const { Row, Col } = Grid;

export default () => {
  const { config } = useContext(UserContext); 
  const [totalCalls, setTotalCalls] = useState([]);
  const [resourcesData, setResourcesData] = useState([]);

  const [errorsAndTotalLoading, setErrorsAndTotalLoading] = useState(false);
  const [errorsAndTotal, setErrorsAndTotal] = useState({
    FunctionClientErrors: [],
    FunctionServerErrors: [],
    FunctionTotalInvocations: [],
  });
  const [errors, setErrors] = useState({
    FunctionClientErrors: [],
    FunctionServerErrors: [],
    FunctionFunctionErrors: [],
  });
  const [memoryUsageLoading, setFunctionMaxMemoryUsageLoading] = useState(false);
  const [memoryUsage, setFunctionMaxMemoryUsage] = useState([]);
  const [avgDurationLoading, setFunctionAvgDurationLoading] = useState(false);
  const [avgDuration, setFunctionAvgDuration] = useState([]);
  const [qualifierDestinationLoading, setQualifierDestinationLoading] = useState(false);
  const [qualifierDestination, setQualifierDestination] = useState({
    FunctionQualifierDestinationSuccessed: [],
    FunctionQualifierDestinationErrors: []
  })
  const [asyncExpiredDroppedLoading, setFunctionQualifierAsyncEventExpiredDroppedLoading] = useState(false);
  const [asyncExpiredDropped, setFunctionQualifierAsyncEventExpiredDropped] = useState([]);


  async function getData() {
    // 总数
    const functionTotalInvocations = await getMetricData({ ...config, metric: 'FunctionTotalInvocations' });
    setTotalCalls(functionTotalInvocations);
    // 资源使用计算
    const functionOnDemandUsage = await getMetricData({ ...config, metric: 'FunctionOnDemandUsage' });
    setResourcesData(functionOnDemandUsage);
    // 获取错误指标
    const functionClientErrors = await getMetricData({ ...config, metric: 'FunctionClientErrors' });
    const functionServerErrors = await getMetricData({ ...config, metric: 'FunctionServerErrors' });
    setErrorsAndTotal({
      FunctionClientErrors: functionClientErrors,
      FunctionServerErrors: functionServerErrors,
      FunctionTotalInvocations: functionTotalInvocations,
    });
    setErrorsAndTotalLoading(false);
    const functionFunctionErrors = await getMetricData({ ...config, metric: 'FunctionFunctionErrors' });
    setErrors({
      FunctionClientErrors: functionClientErrors,
      FunctionServerErrors: functionServerErrors,
      FunctionFunctionErrors: functionFunctionErrors,
    });
    // 内存
    const functionMaxMemoryUsage = await getMetricData({ ...config, metric: 'FunctionMaxMemoryUsage' });
    setFunctionMaxMemoryUsage(functionMaxMemoryUsage);
    setFunctionMaxMemoryUsageLoading(false);
    // 执行时间
    const functionAvgDuration = await getMetricData({ ...config, metric: 'FunctionAvgDuration' });
    setFunctionAvgDuration(functionAvgDuration);
    setFunctionAvgDurationLoading(false);
    // 异步调用目标发送指标
    const functionQualifierDestinationSuccessed = await getMetricData({ ...config, metric: 'FunctionQualifierDestinationSuccessed', Project: 'aliyun_fc' });
    const functionQualifierDestinationErrors = await getMetricData({ ...config, metric: 'FunctionQualifierDestinationErrors', Project: 'aliyun_fc' });
    setQualifierDestination({
      FunctionQualifierDestinationSuccessed: functionQualifierDestinationSuccessed,
      FunctionQualifierDestinationErrors: functionQualifierDestinationErrors
    });
    setQualifierDestinationLoading(false);
    // 异步消息超时丢弃
    const functionQualifierAsyncEventExpiredDropped = await getMetricData({ ...config, metric: 'FunctionQualifierAsyncEventExpiredDropped', Project: 'aliyun_fc' });
    setFunctionQualifierAsyncEventExpiredDropped(functionQualifierAsyncEventExpiredDropped.map(({ timestamp, asyncEventExpiredDropped }) => ({ timestamp, Value: asyncEventExpiredDropped })));
    setFunctionQualifierAsyncEventExpiredDroppedLoading(false);
  }

  useEffect(() => {
    if (!isEmpty(config)) {
      setErrorsAndTotalLoading(true);
      setFunctionMaxMemoryUsageLoading(true);
      setFunctionAvgDurationLoading(true);
      setQualifierDestinationLoading(true);
      setFunctionQualifierAsyncEventExpiredDroppedLoading(true);
      getData();
    }
  }, [config]);

  return (
    <Fragment>
      <Calls
        totalCalls={totalCalls}
        resourcesData={resourcesData}
        errors={errors}
      />
      <Row className="marginBottom">
        <Col span={16}>
          <TotalCalls
            {...errorsAndTotal}
            loading={errorsAndTotalLoading}
            conf={{ ...config }}
          />
        </Col>
        <Col span={8}>
          <StateProportion
            {...errorsAndTotal}
            loading={errorsAndTotalLoading}
          />
        </Col>
      </Row>
      <Row>
        <Col span={6}>
          <LineChart
            data={memoryUsage}
            loading={memoryUsageLoading}
            titleNode={<div className="chartTitle">内存使用（MB）</div>}
          />
        </Col>
        <Col span={6}>
          <LineChart
            data={avgDuration}
            loading={avgDurationLoading}
            titleNode={<div className="chartTitle">时间消耗（ms）</div>}
          />
        </Col>
        <Col span={6}>
          <QualifierDestination
            data={qualifierDestination}
            loading={qualifierDestinationLoading}
            titleNode={<div className="chartTitle">异步调用目标发送指标（次）</div>}
          />
        </Col>
        <Col span={6} className="lastLineChartBoxParent">
          <LineChart
            data={asyncExpiredDropped}
            loading={asyncExpiredDroppedLoading}
            titleNode={<div className="chartTitle">异步消息超时丢弃（次）</div>}
          />
        </Col>
      </Row>
    </Fragment>
  );
}