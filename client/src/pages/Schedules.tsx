import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SketchPicker } from 'react-color';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronDown, Link2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Unit {
  id: string;
  name: string;
}

interface EventType {
  name: string;
  duration: number;
  color: string;
  bufferTime: number;
  leadTime: number;
  assignedMember: string;
  units: Unit[];
}

const placeholderEventTypes: EventType[] = [
  {
    name: 'Property Tour',
    duration: 30,
    color: '#3b82f6',
    bufferTime: 15,
    leadTime: 2,
    assignedMember: 'John Doe',
    units: [
      { id: 'unit-1', name: 'Unit 101' },
      { id: 'unit-2', name: 'Unit 102' },
    ],
  },
  {
    name: 'Lease Signing',
    duration: 60,
    color: '#16a34a',
    bufferTime: 30,
    leadTime: 4,
    assignedMember: 'Jane Smith',
    units: [{ id: 'unit-3', name: 'Unit 201' }],
  },
];

export function Schedules() {
  const { toast } = useToast();
  const [eventTypes, setEventTypes] = useState<EventType[]>(placeholderEventTypes);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
  const [openRowIndex, setOpenRowIndex] = useState<number | null>(null);

  const handleEditClick = (eventType: EventType) => {
    setSelectedEventType(eventType);
    setIsEditDialogOpen(true);
  };

  const handleSaveChanges = () => {
    if (selectedEventType) {
      setEventTypes(eventTypes.map((et) => (et.name === selectedEventType.name ? selectedEventType : et)));
      setIsEditDialogOpen(false);
      setSelectedEventType(null);
    }
  };

  const toggleRow = (index: number) => {
    setOpenRowIndex(openRowIndex === index ? null : index);
  };

  const copyBookingLink = (unitId: string) => {
    const bookingLink = `${window.location.origin}/book/${unitId}`;
    navigator.clipboard.writeText(bookingLink);
    toast({ title: 'Booking link copied to clipboard' });
  };

  return (
    <div className='grid auto-rows-max items-start gap-4 lg:gap-8'>
      <Card>
        <CardHeader>
          <CardTitle>Event Booking Types</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Event Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Buffer Time</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Assigned Member</TableHead>
                <TableHead>Color</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventTypes.map((eventType, index) => (
                <>
                  <TableRow key={index}>
                    <TableCell>
                      <Button variant='ghost' size='icon' onClick={() => toggleRow(index)}>
                        <ChevronDown className={`transition-transform ${openRowIndex === index ? 'rotate-180' : ''}`} />
                      </Button>
                    </TableCell>
                    <TableCell>{eventType.name}</TableCell>
                    <TableCell>{eventType.duration} minutes</TableCell>
                    <TableCell>{eventType.bufferTime} minutes</TableCell>
                    <TableCell>{eventType.leadTime} hours</TableCell>
                    <TableCell>{eventType.assignedMember}</TableCell>
                    <TableCell>
                      <div
                        style={{ backgroundColor: eventType.color, width: '20px', height: '20px', borderRadius: '50%' }}
                      ></div>
                    </TableCell>
                    <TableCell>
                      <Button variant='outline' onClick={() => handleEditClick(eventType)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                  {openRowIndex === index && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <div className='p-4'>
                          <h4 className='font-semibold'>Units</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Unit Name</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {eventType.units.map((unit) => (
                                <TableRow key={unit.id}>
                                  <TableCell>{unit.name}</TableCell>
                                  <TableCell className='text-right'>
                                    <Button variant='ghost' size='icon' onClick={() => copyBookingLink(unit.id)}>
                                      <Link2 className='h-4 w-4' />
                                    </Button>
                                    <Button variant='ghost' size='icon'>
                                      <Calendar className='h-4 w-4' />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event Type</DialogTitle>
          </DialogHeader>
          {selectedEventType && (
            <div className='grid gap-4'>
              {/* ... edit form fields ... */}
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveChanges}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
