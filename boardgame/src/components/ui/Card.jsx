import React from 'react';
import { cn } from './Button'; // Utility export

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    padding?: 'none' | 'sm' | 'md' | 'lg';
    variant?: 'default' | 'elevated' | 'bordered';
}

export function Card({
    className,
    padding = 'md',
    variant = 'default',
    children,
    ...props
}: CardProps) {
    const baseStyles = 'bg-white rounded-[24px] overflow-hidden transition-all duration-300';

    const paddings = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    const variants = {
        default: 'shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] border border-slate-100',
        elevated: 'shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100/50',
        bordered: 'border-2 border-slate-200 shadow-sm',
    };

    return (
        <div
            className={cn(baseStyles, paddings[padding], variants[variant], className)}
            {...props}
        >
            {children}
        </div>
    );
}
