import React from 'react';
import {
  Chart,
  Interval,
  Tooltip,
  Axis,
  Coordinate,
  Interaction
} from 'bizcharts';
import { Loading } from '@alicloud/console-components';

const keepDecimal = value => Math.floor(value * 100) / 100;

export default ({
  FunctionClientErrors,
  FunctionServerErrors,
  FunctionTotalInvocations,
  loading
}) => {
  const cols = {
    percent: {
      formatter: val => {
        val = val * 100 + '%';
        return val;
      },
    },
  };

  let totalCallsNum = 0;
  let serversNum = 0;
  let clientNum = 0;
  let succNum = 0;
  FunctionTotalInvocations.forEach(({ Value }) => totalCallsNum += Value);
  FunctionServerErrors.forEach(({ Value }) => serversNum += Value);
  FunctionClientErrors.forEach(({ Value }) => clientNum += Value);
  succNum = totalCallsNum - serversNum - clientNum;

  const dv = totalCallsNum ? [
    { item: '成功调用', count: succNum, percent: keepDecimal(succNum / totalCallsNum) },
    { item: '客户端错误', count: clientNum, percent: keepDecimal(clientNum / totalCallsNum) },
    { item: '服务端错误', count: serversNum, percent: keepDecimal(serversNum / totalCallsNum) }
  ] : [];

  return (
    <div className="stateProportion border">
      <div className="chartTitle">状态比例</div>
      <Loading visible={loading} style={{ display: 'block' }}>
      <Chart
        height={230}
        data={dv}
        scale={cols}
        placeholder={<div className="chartPlaceholder">暂无数据</div>}
        autoFit
      >
        <Coordinate type="theta" radius={0.75} />
        <Tooltip showTitle={false} />
        <Axis visible={false} />
        <Interval
          position="percent"
          adjust="stack"
          color="item"
          style={{
            lineWidth: 1,
            stroke: '#fff',
          }}
          label={['count', {
            content: (data) => {
              return `${data.item}: ${data.percent * 100}%`;
            },
          }]}
          animate={false}
        />
        <Interaction type='element-single-selected' />
      </Chart>
      </Loading>
    </div>
  )
}