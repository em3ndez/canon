import {
  Anchor, Box, Flex, Popover, List, Paper, Center,
} from "@mantine/core";
import React, {
  forwardRef, useMemo, useRef, useState,
} from "react";
import {useWindowEvent, useDisclosure} from "@mantine/hooks";
// import {AnchorLink} from "@datawheel/canon-core";

import SVG from "react-inlinesvg";
import {merge} from "d3-array";

import throttle from "../../../utils/throttle";
import stripHTML from "../../../utils/formatters/stripHTML";

// https://github.com/Datawheel/canon/blob/c949c0089be9aa4ccc67fbe4737b9fd200de6dcf/packages/core/src/components/AnchorLink.jsx
// eslint-disable-next-line react/display-name
const AnchorLink = forwardRef(({
  children, className, dangerouslySetInnerHTML, id, to, onFocus, onBlur, onClick,
}, ref) => {
  if (dangerouslySetInnerHTML) {
    return (
      <Anchor
        ref={ref}
        className={className}
        href={`#${to}`}
        id={id}
        dangerouslySetInnerHTML={dangerouslySetInnerHTML}
        onBlur={onBlur}
        onFocus={onFocus}
        onClick={onClick}
      />
    );
  }

  return (
    <Anchor
      ref={ref}
      className={className}
      href={`#${to}`}
      id={id}
      onClick={onClick}
      onBlur={onBlur}
      onFocus={onFocus}
    >
      { children }
    </Anchor>
  );
});

function Popup({
  section, icons,
}) {
  const [opened, {open, close}] = useDisclosure(false);
  const forceOpen = useRef(false);
  return (
    <Popover
      styles={(theme) => ({
        dropdown: {
          border: "none",
          borderRadius: 0,
          marginTop: 0,
          boxShadow: theme.shadows.sm,
          top: "100% !important",
          left: "0px !important",
        },
      })}
      opened={opened}
      transitionProps={{
        duration: 400,
        exitDuration: 400,
      }}
      trapFocus
    >
      <Popover.Target>
        <Box
          onMouseEnter={open}
          onFocus={open}
          onBlur={close}
          onMouseLeave={() => { setTimeout(() => { if (!forceOpen.current) close(); }, 1000); }}
          role="button"
        >
          <AnchorLink
            className="cp-subnav-link"
            to={section.slug}
          >
            <Center sx={{gap: 5}}>
              {section.icon && icons[section.icon]}
              {section.short && stripHTML(section.short) ? stripHTML(section.short) : stripHTML(section.title)}
            </Center>
          </AnchorLink>
        </Box>
      </Popover.Target>
      <Popover.Dropdown>
        <List
          display="flex"
          sx={{flexDirection: "column", alignItems: "flex-start"}}
          className={`cp-subnav-group-list ${open ? "is-open" : "is-closed"}`}
          listStyleType="none"
          onMouseEnter={() => {
            forceOpen.current = true;
          }}
          onMouseLeave={() => {
            forceOpen.current = false; close();
          }}
          pl="0px !important"
        >
          { section.children.map((child) => (
            <List.Item key={child.id} className="cp-subnav-group-item" sx={{fontSize: 12, fontWeight: 400}}>
              <AnchorLink
                className="cp-subnav-group-link u-font-xs"
                to={child.slug}
              >
                {child.icon && icons[child.icon]}
                {child.short && stripHTML(child.short) ? stripHTML(child.short) : stripHTML(child.title)}
              </AnchorLink>
            </List.Item>
          )) }
        </List>
      </Popover.Dropdown>
    </Popover>
  );
}

export default function Subnav(props) {
  const flattenSections = () => {
    const {sections} = props;
    let flattenedSections = props.sections;
    if (sections
          && Array.isArray(sections)
          && sections[0] && sections[0][0]
          && sections[0][0] === Object(sections[0][0])
    ) {
      // the hierarchy is flat (i.e., <= 1 grouping)
      if (sections.length === 1) {
        flattenedSections = sections[0]
          .map((s) => s[0])
          .filter((s) => s.type.toLowerCase() !== "grouping"); // don't show groupings
      }
      // we got groupings
      else {
        flattenedSections = sections
          .map((s) => {
            const subgroups = s.filter((d) => d[0].type.toLowerCase() === "subgrouping");
            let children = merge(subgroups.length ? subgroups : s.slice(1));
            if (subgroups.length) {
              children = children.map((subgroup) => {
                const obj = {...subgroup};
                obj.children = [];
                const currIndex = s.findIndex((d) => d[0].id === obj.id);
                for (let i = currIndex + 1; i < s.length; i++) {
                  if (s[i][0].type.toLowerCase() === "subgrouping") break;
                  obj.children.push(s[i]);
                }
                obj.children = merge(obj.children);
                return obj;
              });
            }
            return {...s[0][0], children};
          })
          .filter((s) => s.type.toLowerCase() === "grouping"); // only show groupings
      }
    }

    return flattenedSections;
  };

  const {icons, sections: profileSections} = props;

  const [fixed] = useState(false);
  const [currSection, setCurrSection] = useState(false);
  const [currSubSection, setCurrSubsection] = useState({});
  const subnav = useRef(null);
  const sections = useMemo(flattenSections, [profileSections]);
  const hasSubgroups = useMemo(
    () => sections.some((s) => s.children && s.children.some((c) => c.children)),
    [JSON.stringify(sections)],
  );

  useWindowEvent("scroll", () => {
    const topBorder = 200; // parseStyle("nav-height") + parseStyle("subnav-height");
    // eslint-disable-next-line require-jsdoc
    function getSectionWrapper(slug) {
      let elem = document.getElementById(slug);
      while (
        elem
        && elem.className
        && !elem.className.includes("cp-section ")
        && elem.parentNode) {
        elem = elem.parentNode;
      }
      return elem;
    }

    if (sections) {
      throttle(() => {
        // deteremine which section we're in
        let newSection = false; let
          newSubSection = false;
        sections.forEach((section) => {
          const elem = getSectionWrapper(`cp-section-${section.id}`);
          const top = elem ? elem.getBoundingClientRect().top : 1;
          if (Math.floor(top) <= topBorder) {
            newSection = section;
          }
        });

        if (newSection && newSection.children) {
          newSection.children.forEach((section) => {
            const elem = getSectionWrapper(section.slug);
            const top = elem ? elem.getBoundingClientRect().top : 1;

            if (Math.floor(top) <= topBorder) {
              newSubSection = section;
            }
          });
        }
        // update state only when changes detected
        if (currSection !== newSection || currSubSection !== newSubSection) {
          setCurrSection(newSection);
          setCurrSubsection(newSubSection);
        }
      }, 30);
    }
  });

  const {children} = props;

  if (!sections || !Array.isArray(sections) || sections.length < 2) return null;

  const height = 50;
  //     if (typeof window !== "undefined" && this.subnav.current) {
  //       height = this.subnav.current.getBoundingClientRect().height;
  //     }
  return (
    <>
      <Paper
        component="nav"
        pos="sticky"
        top={0}
        className={`cp-subnav ${fixed ? "is-fixed" : "is-static"}`}
        ref={subnav}
        key="s"
        sx={(theme) => ({
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          borderRadius: 0,
          boxShadow: theme.shadows.sm,
        })}
      >
        {children}
        {sections.length
          ? (
            <List
              display="flex"
              className="cp-subnav-list"
              key="l"
              sx={(theme) => ({gap: theme.spacing.md, alignItems: "center", justifyContent: "center"})}
              my="0px !important"
              w="100%"
              listStyleType="none"
            >
              {sections.map((section) => (
                <List.Item
                  h="100%"
                  mt="0px !important"
                  py="sm"
                  className={`cp-subnav-item ${currSection.slug === section.slug ? "is-active" : "is-inactive"}`}
                  sx={(theme) => ({
                    textTransform: "uppercase",
                    fontSize: 16,
                    "& div span a": { // ugh
                      color: currSection.slug === section.slug ? theme.colors["ds-subnav-active"] : "none",
                      transition: "color .45s",
                    },

                  })}
                  lts="0.05"
                  key={section.slug}
                  pos="relative"
                >

                  { section.children && section.children.length
                    ? <Popup section={section} icons={icons} />
                    : (
                      <AnchorLink
                        className={`cp-subnav-link ${sections.length >= 5 ? "u-font-xs" : "u-font-sm"}`}
                        to={section.slug}
                      >
                        <Flex
                          align="center"
                          gap="xs"
                        >
                          <SVG
                            className="nav-icon"
                            width={20}
                            height={20}
                            alt={`${section.title} icon.`}
                            src={`/images/icons/${section.slug}_icon.svg`}
                          />
                          {section.short && stripHTML(section.short)
                            ? stripHTML(section.short)
                            : stripHTML(section.title)}
                        </Flex>
                      </AnchorLink>
                    )}
                </List.Item>
              ))}
            </List>
          )
          : null}
        {hasSubgroups && currSection
          ? (
            <List
              w="100%"
              sx={(theme) => ({gap: theme.spacing.md, alignItems: "center", justifyContent: "center"})}
              display="flex"
              className="cp-subnav-list cp-subnav-secondary"
              key="s"
              listStyleType="none"
            >
              {(currSection ? currSection.children : []).map((section) => (
                <List.Item
                  mt="0px !important"
                  className={`cp-subnav-item ${
                    currSubSection.slug === section.slug ? "is-active" : "is-inactive"}`}
                  sx={(theme) => ({
                    fontWeight: currSubSection.slug === section.slug ? 700 : "none",
                    fontSize: 14,
                    "& .cp-subnav-link a": { // ugh
                      color: currSubSection.slug === section.slug ? theme.colors["ds-subnav-active"] : "none",
                    },

                  })}
                  p="xs"
                  key={section.slug}
                  pos="relative"
                >

                  { section.children && section.children.length
                    ? <Popup section={section} icons={icons} />
                    : (
                      <AnchorLink
                        className={`cp-subnav-link ${sections.length >= 5 ? "u-font-xs" : "u-font-sm"}`}
                        to={section.slug}
                      >
                        {/* {section.icon && blueprintIcons.find(i => i === section.icon) &&
                     <Icon className="cp-subnav-link-icon" icon={section.icon} />
                   } */}
                        {section.short && stripHTML(section.short)
                          ? stripHTML(section.short) : stripHTML(section.title)}
                      </AnchorLink>
                    )}
                </List.Item>
              ))}
            </List>
          )
          : null}
      </Paper>
      {/* prevent page jump */}
      <Box
        display="none"
        className={`cp-subnav-dummy${fixed ? " is-visible" : " is-hidden"}`}
        style={{height}}
        key="d"
      />
    </>
  );
}
