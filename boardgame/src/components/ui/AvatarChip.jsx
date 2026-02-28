import React from 'react';
import { cn } from './Button';

interface AvatarChipProps extends React.HTMLAttributes<HTMLDivElement> {
    name: string;
    avatarUrl?: string;
    status?: 'ready' | 'waiting' | 'turn' | 'none';
    size?: 'sm' | 'md' | 'lg';
}

export function AvatarChip({
    className,
    name,
    avatarUrl,
    status = 'none',
    size = 'md',
    ...props
}: AvatarChipProps) {
    const sizes = {
        sm: { container: 'h-10 pr-4', img: 'w-8 h-8', text: 'text-sm' },
        md: { container: 'h-14 pr-6', img: 'w-11 h-11', text: 'text-base' },
        lg: { container: 'h-16 pr-8', img: 'w-14 h-14', text: 'text-lg font-bold' },
    };

    const statusColors = {
        ready: 'bg-green-500 border-white',
        waiting: 'bg-slate-300 border-white',
        turn: 'bg-yellow-400 border-white animate-pulse',
        none: 'hidden',
    };

    const sizeClass = sizes[size];

    return (
        <div
            className={cn(
                'inline-flex items-center gap-3 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md transition-shadow',
                sizeClass.container,
                className
            )}
            {...props}
        >
            <div className="relative pl-1 py-1">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={name}
                        className={cn('rounded-full object-cover shadow-inner', sizeClass.img)}
                    />
                ) : (
                    <div className={cn('rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-600 font-bold', sizeClass.img)}>
                        {name.charAt(0).toUpperCase()}
                    </div>
                )}

                {status !== 'none' && (
                    <span
                        className={cn(
                            'absolute bottom-0 right-0 block border-2 rounded-full',
                            size === 'sm' ? 'w-2.5 h-2.5 translate-x-1/4 translate-y-1/4' : 'w-3.5 h-3.5',
                            statusColors[status]
                        )}
                    />
                )}
            </div>

            <span className={cn('font-medium text-slate-800', sizeClass.text)}>{name}</span>
        </div>
    );
}
