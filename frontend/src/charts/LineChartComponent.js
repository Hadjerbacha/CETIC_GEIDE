import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const LineChartComponent = ({ 
  data, 
  color, 
  xKey, 
  yKey, 
  yLabel,
  showGrid = true,
  showDots = true
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
        <XAxis 
          dataKey={xKey} 
          tick={{ fill: '#6c757d' }}
          tickMargin={10}
        />
        <YAxis 
          tick={{ fill: '#6c757d' }}
          label={yLabel ? { 
            value: yLabel, 
            angle: -90, 
            position: 'insideLeft',
            fill: '#6c757d'
          } : null}
        />
        <Tooltip 
          contentStyle={{
            background: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        />
        <Legend 
          layout="horizontal" 
          verticalAlign="top" 
          align="center"
          wrapperStyle={{ paddingBottom: '10px' }}
        />
        <Line 
          type="monotone" 
          dataKey={yKey} 
          stroke={color} 
          strokeWidth={2}
          dot={showDots ? { r: 4 } : false}
          activeDot={showDots ? { r: 6, strokeWidth: 2 } : false}
          name={yLabel || yKey}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LineChartComponent;