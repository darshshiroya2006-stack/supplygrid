import React from "react";

export function Logo({ className = "w-8 h-8", strokeColor }: { className?: string; strokeColor?: string }) {
  return (
    <div className={`${className} flex items-center justify-center`}>
      <img 
        src="/supplygrid-logo.png" 
        alt="SupplyGrid Logo" 
        className="w-full h-full object-contain" 
        style={{ filter: "invert(1) sepia(1) saturate(10) hue-rotate(5deg)", mixBlendMode: "multiply" }}
      />
    </div>
  );
}


