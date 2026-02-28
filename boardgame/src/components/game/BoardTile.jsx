import React from 'react';
import { cn } from '../ui/Button';
import { Zap, Snowflake, Swords, HelpCircle, Star } from 'lucide-react';

export type TileType = 'normal' | 'speed' | 'freeze' | 'challenge' | 'mystery' | 'duel';

interface BoardTileProps {
    type?: TileType;
    label?: string;
    active?: boolean;
    players?: string[]; // IDs or names of players on this tile
    className?: string;
}

const typeConfig = {
    normal: { color: 'bg-white', icon: null, badge: 'text-slate-400' },
    speed: { color: 'bg-yellow-50', icon: Zap, badge: 'bg-yellow-100 text-yellow-700', label: 'Speed' },
    freeze: { color: 'bg-sky-50', icon: Snowflake, badge: 'bg-sky-100 text-sky-700', label: 'Freeze' },
    challenge: { color: 'bg-orange-50', icon: Swords, badge: 'bg-orange-100 text-orange-700', label: 'Hard' },
    mystery: { color: 'bg-purple-50', icon: HelpCircle, badge: 'bg-purple-100 text-purple-700', label: 'Mystery' },
    duel: { color: 'bg-pink-50', icon: Star, badge: 'bg-pink-100 text-pink-700', label: 'Duel' },
};

export function BoardTile({
    type = 'normal',
    label,
    active = false,
    players = [],
    className
}: BoardTileProps) {
    const config = typeConfig[type];
    const Icon = config.icon;

    return (
        <div className={cn(
            "relative aspect-square w-24 h-24 rounded-2xl flex flex-col items-center justify-center transition-all duration-300",
            "border-2",
            active ? "border-blue-500 shadow-lg scale-105 z-10" : "border-slate-100 shadow-sm",
            config.color,
            className
        )}>
            {/* Tile Type Badge */}
            {type !== 'normal' && (
                <span className={cn(
                    "absolute -top-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    config.badge
                )}>
                    {config.label}
                </span>
            )}

            {/* Main Content */}
            <div className="flex flex-col items-center gap-1">
                {Icon && <Icon className={cn("w-6 h-6", config.badge.split(' ')[1])} />}
                <span className="text-xs font-medium text-slate-500 leading-tight text-center px-2">
                    {label || (type === 'normal' ? '' : config.label)}
                </span>
            </div>

            {/* Players on Tile */}
            <div className="absolute -bottom-2 flex -space-x-2">
                {players.map((_, i) => (
                    <div
                        key={i}
                        className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold"
                    >
                        P{i + 1}
                    </div>
                ))}
            </div>
        </div>
    );
}
