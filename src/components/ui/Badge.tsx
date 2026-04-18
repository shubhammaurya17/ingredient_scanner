import React from 'react';
import { cn } from '../../lib/utils';

export const Badge = React.memo(({
  children,
  variant = 'gray',
  className
}: {
  children: React.ReactNode,
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gray',
  className?: string
}) => {
  const variants = {
    green: 'bg-green-50 text-green-700 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-100',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center', variants[variant], className)}>
      {children}
    </span>
  );
});
