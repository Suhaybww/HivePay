import * as React from "react"
import ReactDatePicker from "react-datepicker"
import { CalendarIcon } from "lucide-react"
import "react-datepicker/dist/react-datepicker.css"
import { Button } from "@/src/components/ui/button"
import { cn } from "@/src/lib/utils"

interface DatePickerProps {
  selectedDate?: Date
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  selectedDate,
  onDateChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  return (
    <div className="relative">
      <ReactDatePicker
        selected={selectedDate}
        onChange={(date) => onDateChange(date || undefined)}
        dateFormat="MMMM d, yyyy"
        placeholderText={placeholder}
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "placeholder:text-muted-foreground focus:outline-none focus:ring-2",
          "focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        wrapperClassName="w-full"
        showPopperArrow={false}
        customInput={
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? selectedDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            }) : placeholder}
          </Button>
        }
        calendarClassName="bg-popover border rounded-md shadow-md p-2"
        dayClassName={(d) => cn(
          "rounded-md hover:bg-accent hover:text-accent-foreground",
          "mx-0.5 text-sm leading-9 text-center",
          d.toDateString() === new Date().toDateString() && "bg-accent text-accent-foreground"
        )}
      />
    </div>
  )
}