// contexts/ViewModeContext.js
// Lets an ADMIN switch between the admin tools and the full member (student)
// experience. `role` is the real account role; `viewMode` is what they're
// currently looking at ('admin' | 'member'). `effectiveRole` is what screens
// should branch on — an admin in member mode behaves like a student.
import React, { createContext, useContext } from 'react';

const ViewModeContext = createContext({
  role: 'student',
  viewMode: 'member',
  setViewMode: () => {},
  effectiveRole: 'student',
  canToggle: false,
});

export const ViewModeProvider = ({ role, viewMode, setViewMode, children }) => {
  const effectiveRole = role === 'admin' && viewMode === 'member' ? 'student' : role;
  return (
    <ViewModeContext.Provider
      value={{ role, viewMode, setViewMode, effectiveRole, canToggle: role === 'admin' }}
    >
      {children}
    </ViewModeContext.Provider>
  );
};

export const useViewMode = () => useContext(ViewModeContext);

export default ViewModeContext;
