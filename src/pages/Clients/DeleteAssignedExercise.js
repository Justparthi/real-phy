import React, { useContext, useState } from "react";
import { motion } from "framer-motion";
import { RiDeleteBin6Line } from "react-icons/ri";
import styles from "./DeleteAssignedExercise.module.scss";
import { db } from "../../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { database } from "../../firebase";
import { get, ref as dbRef, child, remove, equalTo } from "firebase/database";
import { AuthContext } from "../../components/data_fetch/authProvider";
import { Center, Spinner, useToast } from "@chakra-ui/react";

export default function DeleteAssignedExercise({
  id,
  clientId,
  exerciseName,
  setAssignedExercises,
  isOpenDelete,
  toggleDeleteModal,
}) {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // To Unassign an exercise
  const handleUnassignExercise = async () => {
    setLoading(true);
    try {
      // 1. Find the client reference based on clientId
      let clientRef = null;
      const res = await getDocs(
        query(collection(db, "Users"), where("userId", "==", clientId))
      );
      if (!res.empty) {
        clientRef = res.docs[0].ref; // Fetch client reference
      }

      const exerciseRef = doc(clientRef, "exercises", id);
      const docsnap = await getDoc(exerciseRef);

      // To update the assignedOn time in the physiotherapist collection
      let timeAssignedOn = null;
      if (docsnap.exists()) {
        const data = docsnap.data();
        timeAssignedOn = data.assignedOn;
        console.log("Document data:", timeAssignedOn);
      } else {
        console.log("No such document!");
      }

      // 2. Update the physiotherapist's assignedOn array
      const getPhysios = await getDocs(
        query(collection(db, "physiotherapist"), where("physiotherapistId", "==", user.uid))
      );
      const physioRef = getPhysios.docs[0].ref;
      const physiosnap = await getDoc(physioRef);
      let arr = null;
      if (physiosnap.exists()) {
        const data = physiosnap.data();
        arr = data.assignedOn || []; // Make sure arr is an empty array if undefined
        console.log("Assigned On:", arr);
      } else {
        console.log("No data for physiotherapist");
        arr = []; // In case no data, initialize as empty array
      }

      // Filter the assignedOn array to remove the exercise
      const updatedArray = arr.filter(
        (Timestamp) => Timestamp.seconds !== timeAssignedOn?.seconds
      );
      await updateDoc(physioRef, { assignedOn: updatedArray });

      // 3. Delete the exercise from Firestore
      await deleteDoc(exerciseRef);

      // 4. Remove the exercise from Realtime Database
      const exercisesRef = dbRef(
        database,
        "assignedExercise/" + clientId + "/exercises"
      );

      const querryref = query(exercisesRef, equalTo(id));
      const snapshot = await get(querryref);

      if (snapshot.exists()) {
        const childKey = Object.keys(snapshot.val()).find(
          (key) => snapshot.val()[key]["id"] === id
        );

        if (childKey) {
          await remove(child(exercisesRef, childKey));
          console.log("Node deleted successfully from Realtime Database.");
        } else {
          console.log("Node not found in Realtime Database.");
        }
      }

      // 5. Remove the clientId from the exercise's 'assignedTo' list in Firestore
      const exRef = doc(db, "exercises", id);
      const exerciseSnapshot = await getDoc(exRef);

      if (exerciseSnapshot.exists()) {
        const exerciseData = exerciseSnapshot.data();
        if (
          exerciseData.assignedTo &&
          exerciseData.assignedTo.includes(clientId)
        ) {
          const newAssignedTo = exerciseData.assignedTo.filter(
            (assignedClientId) => assignedClientId !== clientId
          );
          await updateDoc(exRef, { assignedTo: newAssignedTo });
        } else {
          console.log("Exercise is not assigned to the client.");
        }
      } else {
        console.log("Exercise does not exist.");
      }

      // 6. Update the state and notify the user
      setAssignedExercises();
      setLoading(false);
      toast({
        title: "Exercise unassigned successfully",
        status: "success",
        isClosable: true,
      });
    } catch (error) {
      console.error("Error unassigning exercise:", error);
      setLoading(false);
      toast({
        title: "Error unassigning exercise!",
        status: "error",
        isClosable: true,
      });
    }
  };

  return (
    <div>
      <Center className={styles.button}>
        <RiDeleteBin6Line
          color="#0d30ac"
          className={styles.dot}
          onClick={toggleDeleteModal}
        />
      </Center>
      {isOpenDelete && (
        <div className={styles.recheckDelete}>
          <div>
            <h3>
              Delete <span style={{ color: "#0d1dac" }}>{exerciseName}</span>
            </h3>
            <p>Are you sure? You can't undo this action afterwards.</p>
          </div>
          <div className={styles.buttonDelete}>
            <div className={styles.bottoncover}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                style={{
                  borderColor: "#0d30ac",
                  color: "#0d30ac",
                  borderWidth: "1px",
                }}
                className={styles.button1}
                onClick={toggleDeleteModal}
              >
                Cancel
              </motion.button>
              {loading ? (
                <Center
                  style={{ backgroundColor: "#0d30ac" }}
                  className={styles.button1}
                >
                  <Spinner color="white" />
                </Center>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  className={styles.button1}
                  style={{ backgroundColor: "#0d30ac", color: "white" }}
                  onClick={handleUnassignExercise}
                >
                  Delete
                </motion.button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
