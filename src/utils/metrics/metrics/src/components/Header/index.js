import React, { useRef, useEffect, useContext } from 'react';
import { Grid, Icon } from '@alicloud/console-components';

import { UserContext } from '../../context';
import Qualifier from './Qualifier';
import TimeRangePicker from './TimeRangePicker';
import { ICONURL } from '../../constants'
import './index.css';

const { Row, Col } = Grid;

const CustomIcon = Icon.createFromIconfontCN({
  scriptUrl: ICONURL,
});

export default () => {
  const { setConfig } = useContext(UserContext)
  const timeRangePickerRef = useRef(null);
  const qualifierRef = useRef(null);

  useEffect(() => {
    getConfig()
  }, [])

  const getConfig = () => {
    const { endTime, startTime, period } = timeRangePickerRef.current;
    const { qualifier } = qualifierRef.current;
    setConfig({ endTime, startTime, period, qualifier });
  }

  return (
    <Row className="header">
      <Col className="header-logo-box">
        <CustomIcon type="icon-aliyun" className="header-logo" />
        <span className="header-title">Function Metrics</span>
      </Col>
      
      <Qualifier
        ref={qualifierRef}
        getConfig={getConfig}
      />
      <TimeRangePicker
        ref={timeRangePickerRef}
        getConfig={getConfig}
      />
    </Row>
  )
}