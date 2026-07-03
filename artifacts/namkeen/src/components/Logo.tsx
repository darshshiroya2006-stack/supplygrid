import React from "react";

export function Logo({ className = "w-8 h-8", strokeColor = "#f97316" }: { className?: string; strokeColor?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <path 
        d="M50 15L20 32.5V67.5L50 85L80 67.5V32.5L50 15Z" 
        stroke={strokeColor} 
        strokeWidth="6" 
        strokeLinejoin="round"
      />
      <path 
        d="M20 32.5L50 50L80 32.5" 
        stroke={strokeColor} 
        strokeWidth="6" 
        strokeLinejoin="round"
      />
      <path 
        d="M50 50V85" 
        stroke={strokeColor} 
        strokeWidth="6" 
        strokeLinejoin="round"
      />
      <circle cx="50" cy="50" r="5" fill="#ffffff" />
      <circle cx="50" cy="15" r="5" fill="#ffffff" />
      <circle cx="20" cy="32.5" r="5" fill="#ffffff" />
      <circle cx="80" cy="32.5" r="5" fill="#ffffff" />
      <circle cx="50" cy="85" r="5" fill="#ffffff" />
    </svg>
  );
}
