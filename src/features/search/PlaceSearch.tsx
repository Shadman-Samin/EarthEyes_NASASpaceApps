import { useDeferredValue, useState } from "react"
import { Command } from "cmdk"
import type { Place } from "../../domain/models"
import { usePlaces } from "../../data/queries"
import { Icon, Skeleton } from "../../shared/ui"

export function PlaceSearch({
  currentPlace,
  onSelect,
  compact = false,
}: {
  currentPlace?: Place
  onSelect: (place: Place) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const placesQuery = usePlaces(deferredQuery)

  const choose = (place: Place) => {
    onSelect(place)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className={`place-search ${compact ? "place-search--compact" : ""}`}>
      <Command shouldFilter={false} label="Search places and investigations">
        <div className="place-search__input-wrap">
          <Icon name="search" size={17} />
          <Command.Input
            value={query}
            onValueChange={(value) => {
              setQuery(value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder={currentPlace ? `Search from ${currentPlace.name}` : "Search a coast, glacier, lake, or district"}
            aria-label="Search locations"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
              <Icon name="close" size={15} />
            </button>
          )}
        </div>

        {open && (
          <Command.List className="place-search__results" onMouseDown={(event) => event.preventDefault()}>
            {placesQuery.isLoading && <div className="place-search__state"><Skeleton lines={3} /></div>}
            {placesQuery.isError && (
              <Command.Empty>Search is unavailable. The current map remains usable.</Command.Empty>
            )}
            {!placesQuery.isLoading && placesQuery.data?.length === 0 && (
              <Command.Empty>No reference place matches. Pan the map and use Search this map area, or enter coordinates in Controls.</Command.Empty>
            )}
            <Command.Group heading={query ? "Matching reference places" : "Reference places / any map area is searchable"}>
              {placesQuery.data?.map((place) => (
                <Command.Item key={place.id} value={place.id} onSelect={() => choose(place)}>
                  <span className="place-search__pin"><Icon name="pin" size={15} /></span>
                  <span>
                    <strong>{place.name}</strong>
                    <small>{place.kind} / {place.country}</small>
                  </span>
                  <span className="place-search__modules">
                    {place.moduleIds.map((moduleId) => <i key={moduleId}>{moduleId}</i>)}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        )}
      </Command>
      {open && <button className="place-search__scrim" type="button" aria-label="Close search results" onClick={() => setOpen(false)} />}
    </div>
  )
}
