// src/components/ui/date-picker.tsx

import * as React from "react"
import ReactDatePicker from "react-datepicker"
import { CalendarIcon } from "lucide-react"
import "react-datepicker/dist/react-datepicker.css"
import { Button } from "@/src/components/ui/button"
import { cn } from "@/src/lib/utils"
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

interface DatePickerProps {
  selectedDate?: Date
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

/**
 * We always interpret user picks as Australia/Melbourne local time.
 * Then we store them as UTC behind the scenes.
 */
export function DatePicker({
  selectedDate,
  onDateChange,
  placeholder = "Pick a date & time",
  className,
}: DatePickerProps) {
  // Convert stored UTC date => Melbourne for display
  const melbourneDate = selectedDate
    ? toZonedTime(selectedDate, "Australia/Melbourne")
    : null

  // When user picks a date/time in the UI, interpret it as Melbourne
  const handleDateChange = (date: Date | null) => {
    if (!date) {
      onDateChange(undefined)
      return
    }
    // interpret user-chosen date as Melbourne local
    const melDate = toZonedTime(date, "Australia/Melbourne")
    // convert that to UTC
    const utcDate = new Date(Date.UTC(
      melDate.getFullYear(),
      melDate.getMonth(),
      melDate.getDate(),
      melDate.getHours(),
      melDate.getMinutes(),
      melDate.getSeconds()
    ))

    onDateChange(utcDate)
  }

  // Display format in Melbourne
  const formatDisplay = (date: Date) =>
    formatInTimeZone(date, "Australia/Melbourne", "MMM d, yyyy h:mm aa")

  return (
    <div className="relative">
      <ReactDatePicker
        selected={melbourneDate}
        onChange={handleDateChange}
        showTimeSelect
        timeFormat="HH:mm"
        timeIntervals={15}
        dateFormat="MMM d, yyyy h:mm aa"
        placeholderText={placeholder}
        shouldCloseOnSelect={false} 
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
          }
        }}
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "placeholder:text-muted-foreground focus:outline-none focus:ring-2",
          "focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        wrapperClassName="w-full"
        showPopperArrow={false}
        autoComplete="off"
        customInput={
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {melbourneDate ? formatDisplay(melbourneDate) : placeholder}
          </Button>
        }
        calendarClassName="bg-popover border rounded-md shadow-md p-2"
        dayClassName={(d) =>
          cn(
            "rounded-md hover:bg-accent hover:text-accent-foreground mx-0.5 text-sm leading-9 text-center",
            d.toDateString() === new Date().toDateString() && "bg-accent text-accent-foreground"
          )
        }
      />
    </div>
  )
}
