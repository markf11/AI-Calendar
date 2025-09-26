import React from 'react'

const TimeGrid: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Hour lines */}
      {Array.from({ length: 24 }, (_, hour) => (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-gray-200"
          style={{ top: `${hour * 64}px` }}
        />
      ))}
      
      {/* Half-hour lines */}
      {Array.from({ length: 24 }, (_, hour) => (
        <div
          key={`half-${hour}`}
          className="absolute left-16 right-0 border-t border-gray-100"
          style={{ top: `${hour * 64 + 32}px` }}
        />
      ))}
    </div>
  )
}

export default TimeGrid