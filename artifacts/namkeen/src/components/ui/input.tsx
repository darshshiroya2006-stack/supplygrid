import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onWheel, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === "number") {
        e.currentTarget.blur();
      }
      if (onWheel) {
        onWheel(e);
      }
    };

    const isPassword = type === "password";

    const inputEl = (
      <input
        type={isPassword ? (showPassword ? "text" : "password") : type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isPassword && "pr-10",
          className
        )}
        ref={ref}
        onWheel={handleWheel}
        {...props}
      />
    );

    if (isPassword) {
      return (
        <div className="relative w-full">
          {inputEl}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-orange-500 focus:outline-none focus:text-orange-500 cursor-pointer p-0.5"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      );
    }

    return inputEl;
  }
)
Input.displayName = "Input"

export { Input }
