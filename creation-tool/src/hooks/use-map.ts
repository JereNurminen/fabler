import { useState, useCallback } from 'react';

function useMap<K, V>(initialEntries?: readonly (readonly [K, V])[] | null): {
  map: Map<K, V>;
  set: (key: K, value: V) => void;
  delete: (key: K) => void;
  clear: () => void;
  has: (key: K) => boolean;
  get: (key: K) => V | undefined;
} {
  const [map, setMap] = useState(new Map(initialEntries));

  // Forces the rerender by setting a new Map instance
  const rerender = useCallback(() => {
    setMap(new Map(map));
  }, [map]);

  const set = useCallback(
    (key: K, value: V) => {
      map.set(key, value);
      rerender();
    },
    [map, rerender]
  );

  const deleteKey = useCallback(
    (key: K) => {
      if (map.delete(key)) {
        rerender();
      }
    },
    [map, rerender]
  );

  const clear = useCallback(() => {
    map.clear();
    rerender();
  }, [map, rerender]);

  const has = useCallback((key: K) => map.has(key), [map]);

  const get = useCallback((key: K) => map.get(key), [map]);

  return {
    map,
    set,
    delete: deleteKey,
    clear,
    has,
    get,
  };
}

export default useMap;
