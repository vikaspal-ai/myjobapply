// Jobsapply Centralized Reactive State Store
// Manages candidate profile, location preferences, active filters, and workflow stages

export const state = {
  candidates: [],
  activeCandidateId: null,
  candidateProfile: null,
  facts: [],
  jobs: [],
  applications: [],
  outreachMessages: [],
  activeStep: 'profile', // 'profile' | 'jobs' | 'resume' | 'apply' | 'referrals'
  selectedLocation: 'all',
  realOnly: true,
  searchQuery: '',
};

// Event emitter for reactive UI updates
const listeners = new Map();

export function on(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, []);
  }
  listeners.get(event).push(callback);
}

export function emit(event, data) {
  if (listeners.has(event)) {
    listeners.get(event).forEach(cb => cb(data));
  }
}
