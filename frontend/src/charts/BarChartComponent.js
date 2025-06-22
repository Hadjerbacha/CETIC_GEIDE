import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';

export default function BarChartComponent({ data, colors, showGrid = true }) {
  return (
    <BarChart data={data}>
      {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />}
      <XAxis dataKey="name" tick={{ fill: '#6c757d' }} />
      <YAxis tick={{ fill: '#6c757d' }} />
      <Tooltip 
        contentStyle={{
          background: '#ffffff',
          border: 'none', 
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      />
      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
        ))}
      </Bar>
    </BarChart>
  );
}