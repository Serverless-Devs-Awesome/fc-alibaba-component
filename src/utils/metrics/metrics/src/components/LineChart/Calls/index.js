import React from 'react';
import { Grid } from '@alicloud/console-components';
import './index.css'
const { Row, Col } = Grid;

export default (props) => {
  const { totalCalls, resourcesData, errors } = props;
  let totalCallsNum = 0;
  let totalCallsUnit = '次';
  let resourcesNum = 0;
  let allErrorsNum = 0;
  let allErrorsUnit = '次';

  totalCalls.forEach(({ Value }) => totalCallsNum += Value);
  if (totalCallsNum > 10000) {
    totalCallsUnit = '万次';
    totalCallsNum = Math.floor(totalCallsNum / 100) / 100
  }

  resourcesData.forEach(({ Value }) => resourcesNum += Value);
  resourcesNum = resourcesNum / (10 * 1024);

  Object.keys(errors).forEach(metric => errors[metric].forEach(({ Value }) => allErrorsNum += Value ))
  if (allErrorsNum > 10000) {
    allErrorsUnit = '万次';
    allErrorsNum = Math.floor(allErrorsNum / 100) / 100
  }

  return (
    <Row className="lineChart marginBottom" gutter={16}>
      <Col>
        <div className="border">
          <div className="chart1">
            <span>调用总次数</span>
            <span>{totalCallsNum}</span>
            <span>{totalCallsUnit}</span>
          </div>
          <div className="tip">统计时间范围内，调用总次数</div>
        </div>
      </Col>

      <Col>
        <div className="border">
          <div className="chart1">
            <span>资源使用量</span>
            <span>{Math.floor(resourcesNum * 1000) / 1000}</span>
            <span>cus</span>
          </div>
          <div className="tip">统计时间范围内，有效调用次数资源量（不包括预留等）</div>
        </div>
      </Col>

      <Col>
        <div className="border">
          <div className="chart1">
            <span>错误总次数</span>
            <span>{allErrorsNum}</span>
            <span>{allErrorsUnit}</span>
          </div>
          <div className="tip">统计时间范围内，失败总次数</div>
        </div>
      </Col>
    </Row>
    
  )
}