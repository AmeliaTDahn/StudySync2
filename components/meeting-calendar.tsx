import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventInput } from '@fullcalendar/core';
import { supabase, type Meeting, type UserType, type MeetingStatus, updateMeetingStatus } from '../lib/supabase';

interface MeetingCalendarProps {
  userId: string;
  userType: UserType;
}

// Omit id from Meeting and explicitly define it as string for FullCalendar
type CalendarMeeting = Omit<Meeting, 'id'> & {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  tutor: { username: string };
  student: { username: string };
};

const statusColors: Record<MeetingStatus, string> = {
  pending: '#FCD34D',    // Yellow
  confirmed: '#34D399',  // Green
  completed: '#60A5FA',  // Blue
  cancelled: '#9CA3AF'   // Gray
};

export default function MeetingCalendar({ userId, userType }: MeetingCalendarProps) {
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<CalendarMeeting | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    console.log('Setting up subscription for', userType, userId);
    loadMeetings();
    const subscription = supabase
      .channel(`meetings:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings',
          filter: userType === 'student' 
            ? `student_id=eq.${userId}`
            : `tutor_id=eq.${userId}`
        },
        (payload) => {
          console.log('Meeting update received:', payload);
          if (payload.eventType === 'INSERT') {
            console.log('Handling INSERT event');
            const newMeeting = payload.new as Meeting;
            const mappedMeeting = {
              ...newMeeting,
              id: newMeeting.id.toString(),
              title: userType === 'student' 
                ? `Meeting with ${newMeeting.tutor_username}`
                : `Meeting with ${newMeeting.student_username}`,
              start: newMeeting.start_time,
              end: newMeeting.end_time,
              backgroundColor: statusColors[newMeeting.status as MeetingStatus],
              borderColor: statusColors[newMeeting.status as MeetingStatus],
              tutor: { username: newMeeting.tutor_username },
              student: { username: newMeeting.student_username },
            };
            console.log('Adding new meeting to state:', mappedMeeting);
            setMeetings(prev => [...prev, mappedMeeting]);
          } else if (payload.eventType === 'UPDATE') {
            console.log('Handling UPDATE event');
            const updatedMeeting = payload.new as Meeting;
            setMeetings(prev => prev.map(meeting => 
              meeting.id === updatedMeeting.id.toString()
                ? {
                    ...updatedMeeting,
                    id: updatedMeeting.id.toString(),
                    title: userType === 'student' 
                      ? `Meeting with ${updatedMeeting.tutor_username}`
                      : `Meeting with ${updatedMeeting.student_username}`,
                    start: updatedMeeting.start_time,
                    end: updatedMeeting.end_time,
                    backgroundColor: statusColors[updatedMeeting.status as MeetingStatus],
                    borderColor: statusColors[updatedMeeting.status as MeetingStatus],
                    tutor: { username: updatedMeeting.tutor_username },
                    student: { username: updatedMeeting.student_username },
                  }
                : meeting
            ));
          } else if (payload.eventType === 'DELETE') {
            console.log('Handling DELETE event');
            const deletedMeeting = payload.old as Meeting;
            setMeetings(prev => prev.filter(meeting => meeting.id !== deletedMeeting.id.toString()));
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [userId, userType]);

  const loadMeetings = async () => {
    try {
      console.log('Loading meetings for', userType, userId);
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .or(
          userType === 'student'
            ? `student_id.eq.${userId}`
            : `tutor_id.eq.${userId}`
        );

      if (error) throw error;

      console.log('Raw meetings data:', data);
      const calendarMeetings = (data || []).map(meeting => {
        const mappedMeeting = {
          ...meeting,
          id: meeting.id.toString(),
          title: userType === 'student' 
            ? `Meeting with ${meeting.tutor_username}`
            : `Meeting with ${meeting.student_username}`,
          start: meeting.start_time,
          end: meeting.end_time,
          backgroundColor: statusColors[meeting.status as MeetingStatus],
          borderColor: statusColors[meeting.status as MeetingStatus],
          tutor: { username: meeting.tutor_username },
          student: { username: meeting.student_username },
        };
        console.log('Mapped calendar meeting:', mappedMeeting);
        return mappedMeeting;
      });

      console.log('Setting meetings state:', calendarMeetings);
      setMeetings(calendarMeetings);
    } catch (err) {
      console.error('Error loading meetings:', err);
      setError('Failed to load meetings');
    }
  };

  const handleEventClick = (info: any) => {
    const meeting = meetings.find(m => m.id === info.event.id);
    if (meeting) {
      setSelectedMeeting(meeting);
      setShowModal(true);
    }
  };

  const handleUpdateStatus = async (status: MeetingStatus) => {
    if (!selectedMeeting) return;

    try {
      const { error: updateError } = await updateMeetingStatus(parseInt(selectedMeeting.id), status);
      if (updateError) throw updateError;
      
      setShowModal(false);
      setSelectedMeeting(null);
      await loadMeetings();
    } catch (err) {
      console.error('Error updating meeting status:', err);
      setError('Failed to update meeting status');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}
      
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={meetings as EventInput[]}
        eventClick={handleEventClick}
        height="auto"
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
        allDaySlot={false}
        nowIndicator={true}
        editable={false}
        selectable={false}
        selectMirror={true}
        dayMaxEvents={true}
      />

      {/* Meeting Details Modal */}
      {showModal && selectedMeeting && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full relative z-50">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold">Meeting Details</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedMeeting(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                ×
              </button>
            </div>
            
            <div className="mt-4 space-y-3">
              <p>
                <span className="font-medium">With:</span>{' '}
                {userType === 'student' ? selectedMeeting.tutor.username : selectedMeeting.student.username}
              </p>
              <p>
                <span className="font-medium">Subject:</span> {selectedMeeting.subject}
              </p>
              <p>
                <span className="font-medium">Start:</span>{' '}
                {new Date(selectedMeeting.start_time).toLocaleString()}
              </p>
              <p>
                <span className="font-medium">End:</span>{' '}
                {new Date(selectedMeeting.end_time).toLocaleString()}
              </p>
              {selectedMeeting.notes && (
                <p>
                  <span className="font-medium">Notes:</span> {selectedMeeting.notes}
                </p>
              )}
              <p>
                <span className="font-medium">Status:</span>{' '}
                <span className={`
                  px-2 py-1 rounded-full text-sm
                  ${selectedMeeting.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    selectedMeeting.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    selectedMeeting.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'}
                `}>
                  {selectedMeeting.status.charAt(0).toUpperCase() + selectedMeeting.status.slice(1)}
                </span>
              </p>
            </div>

            {userType === 'tutor' && selectedMeeting.status === 'pending' && (
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => handleUpdateStatus('confirmed')}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleUpdateStatus('cancelled')}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            )}

            {(userType === 'tutor' || userType === 'student') && selectedMeeting.status === 'confirmed' && (
              <div className="mt-6">
                <button
                  onClick={() => handleUpdateStatus('completed')}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Mark as Completed
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 