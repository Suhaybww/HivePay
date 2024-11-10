import { ChevronRight } from "lucide-react"
 
import { Button } from "@/src/components/ui/button"
 
export function ButtonIcon() {
  return (
    <Button variant="outline" size="icon">
      <ChevronRight />
    </Button>
  )
}