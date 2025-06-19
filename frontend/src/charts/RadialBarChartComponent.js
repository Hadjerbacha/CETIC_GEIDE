import React from 'react';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const RadialBarChartComponent = ({ data, colors }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart 
        innerRadius="20%" 
        outerRadius="100%" 
        data={data.map((item, index) => ({
          ...item,
          fill: colors[index % colors.length]
        }))}
        startAngle={180}
        endAngle={0}
      >
        <PolarAngleAxis 
          type="number" 
          domain={[0, 100]} 
          angleAxisId={0} 
          tick={{ fill: '#6c757d' }}
        />
        <RadialBar
          background
          dataKey="value"
          cornerRadius={10}
          label={{ position: 'insideStart', fill: '#fff' }}
        />
        <Legend 
          layout="horizontal" 
          verticalAlign="bottom" 
          align="center"
          wrapperStyle={{ paddingTop: '20px' }}
        />
        <Tooltip 
          contentStyle={{
            background: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            color: '#333'
          }}
          formatter={(value, name, props) => [`${value}%`, name]}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

export default RadialBarChartComponent;