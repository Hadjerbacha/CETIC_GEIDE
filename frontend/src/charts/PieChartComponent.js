import React from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

export default function PieChartComponent({ data, colors, showLabel = false }) {
  return (
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        labelLine={false}
        outerRadius={showLabel ? 120 : 100}
        innerRadius={showLabel ? 60 : 50}
        fill="#8884d8"
        dataKey="value"
        label={showLabel ? ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%` : null}
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
        ))}
      </Pie>
      <Tooltip 
        contentStyle={{
          background: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      />
    </PieChart>
  );
}