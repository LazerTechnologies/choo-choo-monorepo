import { useState, useEffect } from 'react';
import axios from 'axios';

export function useUserCastedStatus() {
  const [hasCurrentUserCasted, setHasCurrentUserCasted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserCastedStatus = async () => {
      try {
        const response = await axios.get('/api/user-casted-status');
        setHasCurrentUserCasted(response.data.hasCurrentUserCasted || false);
      } catch (error) {
        console.error('Error checking user casted status:', error);
        setHasCurrentUserCasted(false);
      } finally {
        setLoading(false);
      }
    };

    checkUserCastedStatus();
  }, []);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/user-casted-status');
      setHasCurrentUserCasted(response.data.hasCurrentUserCasted || false);
    } catch (error) {
      console.error('Error refreshing user casted status:', error);
    } finally {
      setLoading(false);
    }
  };

  return { hasCurrentUserCasted, loading, refreshStatus };
}
