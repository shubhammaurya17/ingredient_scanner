import React, { useState } from 'react';
import { cn } from '../../lib/utils';

export const ProgressiveImage = React.memo(({
  src,
  placeholder,
  alt,
  className
}: {
  src: string;
  placeholder?: string;
  alt: string;
  className?: string
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={cn("relative overflow-hidden bg-gray-100", className)}>
      {placeholder && !isLoaded && (
        <img
          src={placeholder}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 transition-opacity duration-500"
          aria-hidden="true"
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-500",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
